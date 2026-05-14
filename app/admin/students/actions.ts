"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { syncMemberRoles } from "@/lib/discord";
import type { Role } from "@/lib/types";

const VALID_ROLES: Role[] = [
  "student",
  "admin",
  "mentor",
  "investor",
];

async function ensureAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return user.id;
}

export async function changeUserRole(userId: string, role: Role) {
  const actorId = await ensureAdmin();
  if (!VALID_ROLES.includes(role)) throw new Error("Invalid role");
  if (userId === actorId && role !== "admin") {
    throw new Error("You can't downgrade your own admin role.");
  }
  const admin = createAdminClient();
  // Read the core columns first — those are guaranteed to exist.
  const { data: prev } = await admin
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  await logAudit({
    action: "user.role_changed",
    targetType: "profile",
    targetId: userId,
    payload: { from: prev?.role ?? null, to: role, email: prev?.email },
  });

  // Best-effort Discord sync. discord_user_id is added by migration 0008 —
  // tolerate the column being absent so admin role changes still succeed.
  try {
    const { data: link, error: linkErr } = await admin
      .from("profiles")
      .select("discord_user_id")
      .eq("id", userId)
      .maybeSingle();
    if (!linkErr && (link as any)?.discord_user_id) {
      await syncMemberRoles((link as any).discord_user_id, role).catch(
        () => {},
      );
    }
  } catch {
    // ignore — column doesn't exist
  }
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${userId}`);
}

export async function bulkChangeUserRole(input: {
  userIds: string[];
  role: Role;
}): Promise<{ succeeded: number; failed: number; skipped: number }> {
  const actorId = await ensureAdmin();
  if (!VALID_ROLES.includes(input.role)) throw new Error("Invalid role");
  if (input.userIds.length === 0) {
    return { succeeded: 0, failed: 0, skipped: 0 };
  }
  if (input.userIds.length > 200) {
    throw new Error("Cap bulk role changes at 200 users per run.");
  }
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const id of input.userIds) {
    if (id === actorId && input.role !== "admin") {
      skipped++;
      continue;
    }
    try {
      await changeUserRole(id, input.role);
      succeeded++;
    } catch {
      failed++;
    }
  }
  revalidatePath("/admin/students");
  return { succeeded, failed, skipped };
}
