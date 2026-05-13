import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { computeReferralLeaderboard } from "@/lib/referrals";
import { getSiteConfig } from "@/lib/site-config";
import { Crown, Award, TrendingUp, AlertTriangle } from "lucide-react";

export const metadata = { title: "Referrals · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const admin = createAdminClient();
  const siteConfig = await getSiteConfig();
  const enabled = siteConfig.settings.referralsEnabled;
  // Compute the leaderboard either way — when the feature is paused,
  // historical data is still useful for admins (e.g. who recruited
  // before the toggle was flipped). The banner makes the state clear.
  const leaderboard = await computeReferralLeaderboard(admin, 50);

  const totals = leaderboard.reduce(
    (acc, r) => ({
      applied: acc.applied + r.counts.applied,
      accepted: acc.accepted + r.counts.accepted,
      paid: acc.paid + r.counts.paidOrEnrolled,
    }),
    { applied: 0, accepted: 0, paid: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
          <p className="mt-1 text-sm text-white/55">
            Top recruiters by paid enrollments. Sort tiebreaks on accepted
            then total applied.
          </p>
        </div>
        <Link
          href="/admin/settings"
          className="text-xs text-spark hover:underline"
        >
          Toggle referrals globally →
        </Link>
      </div>

      {!enabled && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Referrals are paused program-wide.</p>
            <p className="mt-0.5 text-amber-200/80">
              Students can't view or share their referral links. Historical
              data below is read-only — turn it back on in settings to resume
              tracking.
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="shrink-0 rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-300/20"
          >
            Open settings
          </Link>
        </div>
      )}

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <Tile label="Referred applications" value={totals.applied} icon={TrendingUp} />
        <Tile label="Referred accepted" value={totals.accepted} icon={Award} />
        <Tile label="Referred paid" value={totals.paid} icon={Crown} tone="spark" />
      </section>

      <Card className="mt-6 !p-0 overflow-hidden">
        {leaderboard.length === 0 ? (
          <p className="p-6 text-sm text-white/55">
            No referred applications yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="px-5 py-3 w-12">Rank</th>
                <th className="px-5 py-3">Recruiter</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3 text-right">Applied</th>
                <th className="px-5 py-3 text-right">Accepted</th>
                <th className="px-5 py-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((r, i) => (
                <tr
                  key={r.referralCode}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-5 py-3 text-white/55 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-5 py-3">
                    {r.userId ? (
                      <Link
                        href={`/admin/students/${r.userId}`}
                        className="text-white hover:text-spark"
                      >
                        {r.fullName ?? r.email ?? r.referralCode}
                      </Link>
                    ) : (
                      <span className="text-white/45">
                        (unknown — code {r.referralCode})
                      </span>
                    )}
                    {r.email && r.fullName && (
                      <div className="text-[11px] text-white/40">
                        {r.email}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-white/55">
                    {r.referralCode}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-white/75">
                    {r.counts.applied}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-emerald-300">
                    {r.counts.accepted || (
                      <span className="text-white/25">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-spark">
                    {r.counts.paidOrEnrolled || (
                      <span className="text-white/25">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: any;
  tone?: "default" | "spark";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
        <Icon className={`h-3.5 w-3.5 ${tone === "spark" ? "text-spark" : ""}`} />
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          tone === "spark" ? "text-spark" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
