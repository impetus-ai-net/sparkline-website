import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/ui/card";
import {
  ArrowRight,
  Inbox,
  GraduationCap,
  CreditCard,
  CheckCircle,
} from "lucide-react";

export const metadata = { title: "Admin · SparkLine" };

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminOverview() {
  const admin = createAdminClient();

  const [
    { count: totalApps },
    { count: pendingApps },
    { count: acceptedApps },
    { count: enrolledCount },
    { data: paymentsData },
    { data: recentApps },
  ] = await Promise.all([
    admin.from("applications").select("id", { count: "exact", head: true }),
    admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted"),
    admin.from("enrollments").select("id", { count: "exact", head: true }),
    admin
      .from("payments")
      .select("amount_cents,status")
      .eq("status", "succeeded"),
    admin
      .from("applications")
      .select("id, full_name, status, submitted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const revenueCents = (paymentsData ?? []).reduce(
    (sum, p) => sum + (p.amount_cents ?? 0),
    0,
  );

  const inboxItems = [
    {
      icon: Inbox,
      label: "Pending review",
      count: pendingApps ?? 0,
      href: "/admin/applications?status=submitted",
      tone: (pendingApps ?? 0) > 0 ? "spark" : "muted",
    },
    {
      icon: CreditCard,
      label: "Awaiting payment",
      count: acceptedApps ?? 0,
      href: "/admin/applications?status=accepted",
      tone: (acceptedApps ?? 0) > 0 ? "spark" : "muted",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero row */}
      <div className="border-b border-white/10 pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-spark">
          Admin overview
        </p>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-[-0.02em]">
          What needs your attention.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-white/75 leading-relaxed">
          Daily snapshot of applications, enrollments, and revenue across the
          program.
        </p>
      </div>

      {/* Inbox row — actionable counts, not vanity stats. */}
      <section className="mt-8 grid gap-3 md:grid-cols-2">
        {inboxItems.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="press group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 hover:border-white/25 hover:bg-white/[0.05]"
          >
            <it.icon
              className={`h-5 w-5 shrink-0 ${
                it.tone === "spark" ? "text-spark" : "text-white/40"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                {it.label}
              </p>
              <p
                className={`mt-1 text-3xl font-semibold tracking-tight ${
                  it.tone === "spark" ? "text-spark" : "text-white"
                }`}
              >
                {it.count}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-white/70" />
          </Link>
        ))}
      </section>

      {/* Program metrics — editorial, not card-y. */}
      <section className="mt-12 grid grid-cols-3 gap-6 border-y border-white/10 py-8">
        <Metric
          icon={Inbox}
          label="Total applications"
          value={String(totalApps ?? 0)}
        />
        <Metric
          icon={GraduationCap}
          label="Enrolled"
          value={String(enrolledCount ?? 0)}
        />
        <Metric
          icon={CheckCircle}
          label="Revenue"
          value={fmtMoney(revenueCents)}
        />
      </section>

      {/* Recent applications — editorial list, no inner card chrome. */}
      <section className="mt-12">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Recent applications
          </h2>
          <Link
            href="/admin/applications"
            className="press text-sm text-spark hover:underline"
          >
            View all →
          </Link>
        </div>
        {(recentApps?.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm text-white/55">
            No applications yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {recentApps!.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/applications/${a.id}`}
                  className="press group flex items-center gap-4 py-4 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-white">
                      {a.full_name || "Unnamed applicant"}
                    </p>
                    <p className="mt-0.5 text-xs text-white/55">
                      {fmtTime(a.submitted_at || a.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-white/70" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}
