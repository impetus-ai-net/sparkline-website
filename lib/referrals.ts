import type { SupabaseClient } from "@supabase/supabase-js";

export type ReferrerRow = {
  userId: string | null;
  referralCode: string;
  fullName: string | null;
  email: string | null;
  counts: {
    applied: number;
    accepted: number;
    paidOrEnrolled: number;
    rejected: number;
  };
};

/**
 * Aggregates applications by referral_code into a leaderboard.
 *
 * Joins are JS-side rather than SQL because Supabase PostgREST can't
 * express "group by + aggregate by status" without an RPC. For cohort
 * sizes in the hundreds-of-applications range this is fine; if it
 * grows past that, swap to a materialized view or a database function.
 *
 * Anonymous applications (no referral_code) are excluded entirely.
 */
export async function computeReferralLeaderboard(
  client: SupabaseClient,
  limit = 25,
): Promise<ReferrerRow[]> {
  const { data: apps, error } = await client
    .from("applications")
    .select("referral_code, status")
    .not("referral_code", "is", null);
  if (error) throw new Error(error.message);

  const buckets = new Map<string, ReferrerRow["counts"]>();
  for (const a of (apps ?? []) as Array<{
    referral_code: string;
    status: string;
  }>) {
    const code = a.referral_code.toLowerCase();
    const b = buckets.get(code) ?? {
      applied: 0,
      accepted: 0,
      paidOrEnrolled: 0,
      rejected: 0,
    };
    b.applied++;
    if (a.status === "accepted") b.accepted++;
    if (a.status === "paid" || a.status === "enrolled") b.paidOrEnrolled++;
    if (a.status === "rejected") b.rejected++;
    buckets.set(code, b);
  }

  const codes = Array.from(buckets.keys());
  if (codes.length === 0) return [];

  const { data: referrers } = await client
    .from("profiles")
    .select("id, full_name, email, referral_code")
    .in("referral_code", codes);
  const referrerByCode = new Map(
    (referrers ?? []).map((p: any) => [p.referral_code as string, p]),
  );

  const rows: ReferrerRow[] = codes.map((code) => {
    const profile = referrerByCode.get(code);
    return {
      userId: profile?.id ?? null,
      referralCode: code,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      counts: buckets.get(code)!,
    };
  });

  // Primary sort by paid/enrolled (the actual program contribution),
  // tiebreak on accepted, then on raw applied.
  rows.sort((a, b) => {
    if (b.counts.paidOrEnrolled !== a.counts.paidOrEnrolled) {
      return b.counts.paidOrEnrolled - a.counts.paidOrEnrolled;
    }
    if (b.counts.accepted !== a.counts.accepted) {
      return b.counts.accepted - a.counts.accepted;
    }
    return b.counts.applied - a.counts.applied;
  });

  return rows.slice(0, limit);
}
