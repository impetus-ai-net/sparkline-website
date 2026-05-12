"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

async function ensureAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export type CohortInput = {
  id?: string;
  name: string;
  cohort_number?: number | null;
  starts_on?: string | null;
  ends_on?: string | null;
  capacity: number;
  status: "upcoming" | "active" | "completed" | "cancelled";
  price_cents: number;
};

/**
 * Sync a cohort's price to Stripe. Stripe doesn't allow editing existing
 * Price objects, so when the price changes we create a new one and
 * archive the old one. The Product is reused (and its name updated).
 */
async function syncStripePrice(args: {
  cohortId: string;
  name: string;
  priceCents: number;
  existingProductId: string | null;
  existingPriceId: string | null;
}): Promise<{ productId: string; priceId: string }> {
  const productName = `SparkLine — ${args.name}`;

  let productId = args.existingProductId;
  if (productId) {
    try {
      await stripe.products.update(productId, {
        name: productName,
        active: true,
        metadata: { cohort_id: args.cohortId },
      });
    } catch {
      // Product was deleted in Stripe; recreate.
      productId = null;
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: productName,
      metadata: { cohort_id: args.cohortId },
    });
    productId = product.id;
  }

  // If the existing Price still matches, reuse it.
  if (args.existingPriceId) {
    try {
      const existing = await stripe.prices.retrieve(args.existingPriceId);
      if (
        existing.active &&
        existing.unit_amount === args.priceCents &&
        existing.currency === "usd" &&
        existing.product === productId
      ) {
        return { productId, priceId: existing.id };
      }
      // Price changed — archive the old one.
      try {
        await stripe.prices.update(args.existingPriceId, { active: false });
      } catch {
        // best effort
      }
    } catch {
      // existing price not retrievable; fall through to create a new one
    }
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: args.priceCents,
    currency: "usd",
    metadata: { cohort_id: args.cohortId },
  });
  return { productId, priceId: price.id };
}

export async function saveCohort(input: CohortInput) {
  await ensureAdmin();
  const admin = createAdminClient();

  const basePayload = {
    name: input.name,
    starts_on: input.starts_on || null,
    ends_on: input.ends_on || null,
    capacity: input.capacity,
    status: input.status,
    price_cents: input.price_cents,
  };
  // cohort_number is a newer column (migration 0017). Carry it as an
  // optional field so the action keeps working if the migration hasn't
  // been applied yet — the catch block below retries without it.
  const payload: Record<string, any> = { ...basePayload };
  if (input.cohort_number !== undefined && input.cohort_number !== null) {
    payload.cohort_number = input.cohort_number;
  }

  let cohortId = input.id ?? null;
  let existingProductId: string | null = null;
  let existingPriceId: string | null = null;

  // Postgrest returns a "column does not exist" error when an unmigrated
  // optional column (here: cohort_number) is referenced. Strip it and
  // retry once so the action degrades gracefully.
  function isUnknownColumnError(err: any) {
    const msg = String(err?.message ?? err);
    return /column .*cohort_number.* does not exist/i.test(msg);
  }

  if (cohortId) {
    const { data: existing, error: fetchErr } = await admin
      .from("cohorts")
      .select("stripe_product_id, stripe_price_id")
      .eq("id", cohortId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);
    existingProductId = existing?.stripe_product_id ?? null;
    existingPriceId = existing?.stripe_price_id ?? null;

    let { error } = await admin
      .from("cohorts")
      .update(payload)
      .eq("id", cohortId);
    if (error && isUnknownColumnError(error)) {
      ({ error } = await admin
        .from("cohorts")
        .update(basePayload)
        .eq("id", cohortId));
    }
    if (error) throw new Error(error.message);
  } else {
    let { data: created, error } = await admin
      .from("cohorts")
      .insert(payload)
      .select("id")
      .single();
    if (error && isUnknownColumnError(error)) {
      ({ data: created, error } = await admin
        .from("cohorts")
        .insert(basePayload)
        .select("id")
        .single());
    }
    if (error) throw new Error(error.message);
    cohortId = created!.id;
  }

  // Sync to Stripe — best-effort so a Stripe outage doesn't block cohort
  // edits. Stored IDs are only updated if Stripe succeeded.
  try {
    const synced = await syncStripePrice({
      cohortId: cohortId!,
      name: input.name,
      priceCents: input.price_cents,
      existingProductId,
      existingPriceId,
    });
    await admin
      .from("cohorts")
      .update({
        stripe_product_id: synced.productId,
        stripe_price_id: synced.priceId,
      })
      .eq("id", cohortId!);
  } catch (err) {
    console.error("[cohorts] Stripe sync failed:", err);
  }

  await logAudit({
    action: input.id ? "cohort.updated" : "cohort.created",
    targetType: "cohort",
    targetId: cohortId!,
    payload: { name: input.name, price_cents: input.price_cents, status: input.status },
  });

  revalidatePath("/admin/cohorts");
  // Marketing surfaces read the active cohort — invalidate them so a
  // dates/price/capacity edit shows up immediately.
  revalidatePath("/");
  revalidatePath("/apply");
  revalidatePath("/opengraph-image");
}

export async function deleteCohort(id: string) {
  await ensureAdmin();
  const admin = createAdminClient();

  // Best-effort: archive the Stripe product so it doesn't keep showing
  // up as a sellable item even after the cohort is gone.
  const { data: cohort } = await admin
    .from("cohorts")
    .select("stripe_product_id, stripe_price_id")
    .eq("id", id)
    .single();
  if (cohort?.stripe_price_id) {
    try {
      await stripe.prices.update(cohort.stripe_price_id, { active: false });
    } catch {}
  }
  if (cohort?.stripe_product_id) {
    try {
      await stripe.products.update(cohort.stripe_product_id, { active: false });
    } catch {}
  }

  const { error } = await admin.from("cohorts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({
    action: "cohort.deleted",
    targetType: "cohort",
    targetId: id,
  });
  // Cohort lookups feed several admin lists and student-facing pages —
  // invalidate them so a deleted cohort doesn't linger in dropdowns.
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/students");
  revalidatePath("/admin/teams");
  revalidatePath("/");
  revalidatePath("/apply");
  revalidatePath("/opengraph-image");
}
