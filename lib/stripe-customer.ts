import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

type ProfileInput = {
  id: string;
  email: string | null;
  full_name: string | null;
  stripe_customer_id: string | null;
};

/**
 * Returns a Stripe customer ID that is valid in the *current* Stripe
 * mode (test vs live). If the profile's stored ID belongs to a different
 * mode (or was deleted in the dashboard), it's silently replaced.
 *
 * Why: Stripe's test and live datasets don't share customer IDs. After
 * switching keys, every previously-stored `cus_...` becomes a phantom
 * reference that makes checkout/portal calls throw `resource_missing`.
 */
export async function getOrCreateStripeCustomer(
  admin: SupabaseClient,
  profile: ProfileInput,
  fallbackEmail: string | null | undefined,
): Promise<string> {
  if (profile.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (existing && !(existing as { deleted?: boolean }).deleted) {
        return profile.stripe_customer_id;
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== "resource_missing") throw err;
      // fall through to recreate
    }
  }

  const customer = await stripe.customers.create({
    email: profile.email ?? fallbackEmail ?? undefined,
    name: profile.full_name ?? undefined,
    metadata: { supabase_user_id: profile.id },
  });

  await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", profile.id);

  return customer.id;
}

/**
 * Turn a Stripe SDK error into a user-readable message. Falls back to a
 * generic string so we never leak raw internals to end users, but logs
 * the full error for server-side debugging.
 */
export function stripeErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string; raw?: { message?: string } };
  const raw = e?.raw?.message ?? e?.message ?? "";
  if (/no such price/i.test(raw)) {
    return "This cohort's Stripe price is from a different Stripe mode (test vs live). Open the cohort in admin and save it to regenerate the price.";
  }
  if (/no such customer/i.test(raw)) {
    return "Your Stripe customer record is from a different Stripe mode. Try again — we'll create a fresh one.";
  }
  if (e?.code === "rate_limit") {
    return "Stripe is rate-limiting requests. Try again in a moment.";
  }
  return "Could not start checkout. Please try again, and contact us if it persists.";
}
