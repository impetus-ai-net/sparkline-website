import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { Templates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { formatWeekRange, isoWeekStart, mondayOf } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly cohort digest — one email per active cohort, sent to every
 * enrolled student. Pulls highlights straight from last week's
 * student_checkins so the message shows what teammates have actually
 * been shipping (no synthetic copy / AI summaries).
 *
 * Designed to run Mondays at 14:00 UTC (Monday mid-morning Pacific /
 * mid-afternoon Eastern). The route is idempotent enough for ad-hoc
 * re-runs: it doesn't dedupe sends, so re-triggering will deliver the
 * digest again. The cron schedule is once weekly so duplication only
 * happens if an admin manually hits the endpoint.
 *
 * To wire up: add to `vercel.json` crons (or set up Supabase Edge cron
 * pointed at this URL with the CRON_SECRET header).
 */
export async function GET(req: Request) {
  if (!env.cronSecret) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // "Last week" = the ISO week that just ended. We send Monday morning
  // about the *previous* Monday→Sunday so the data is complete (a
  // digest about the current in-progress week would mostly read as
  // empty for the days that haven't happened yet).
  const previousMonday = (() => {
    const d = mondayOf(new Date());
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const currentMonday = isoWeekStart(new Date());
  const weekRange = formatWeekRange(previousMonday);

  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id, name, status")
    .eq("status", "active");

  let totalEmailsSent = 0;
  const perCohortSummary: Array<{
    cohort: string;
    enrolled: number;
    checkins: number;
    activeStudents: number;
    sent: number;
  }> = [];

  for (const c of cohorts ?? []) {
    // Fetch everything we need for this cohort in parallel.
    const [
      { data: enrollments },
      { data: checkins },
      { data: events },
    ] = await Promise.all([
      admin
        .from("enrollments")
        .select(
          "user_id, profile:profiles!enrollments_user_id_fkey(email, full_name)",
        )
        .eq("cohort_id", c.id),
      admin
        .from("student_checkins")
        .select(
          "accomplished, user_id, week_start, profile:profiles!student_checkins_user_id_fkey(full_name)",
        )
        .eq("cohort_id", c.id)
        .eq("week_start", previousMonday),
      admin
        .from("events")
        .select("title, starts_at")
        .eq("cohort_id", c.id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5),
    ]);

    const enrolled = enrollments?.length ?? 0;
    const activeStudents = new Set(
      (checkins ?? []).map((r: any) => r.user_id),
    ).size;

    // Highlights = the longest, most substantive accomplished snippets.
    // Filter out obviously empty ones and dedupe by user (one per user
    // max, so a chatty student doesn't dominate the digest).
    const seen = new Set<string>();
    const highlights: { name: string | null; accomplished: string }[] = [];
    for (const r of (checkins ?? [])
      .filter((r: any) => (r.accomplished ?? "").trim().length > 30)
      .sort(
        (a: any, b: any) =>
          (b.accomplished?.length ?? 0) - (a.accomplished?.length ?? 0),
      )) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      highlights.push({
        name: profile?.full_name ?? null,
        accomplished: r.accomplished.trim().slice(0, 280),
      });
      if (highlights.length >= 6) break;
    }

    const upcoming = (events ?? []).map((e: any) => ({
      title: e.title,
      startsAt: e.starts_at,
    }));

    const t = Templates.cohortDigest({
      cohortName: c.name,
      weekRange,
      totals: {
        checkins: checkins?.length ?? 0,
        activeStudents,
        enrolled,
      },
      highlights,
      upcomingEvents: upcoming,
    });

    let sent = 0;
    for (const e of enrollments ?? []) {
      const profile = Array.isArray((e as any).profile)
        ? (e as any).profile[0]
        : (e as any).profile;
      const email = profile?.email;
      if (!email) continue;
      const res = await sendEmail({
        to: email,
        subject: t.subject,
        html: t.html,
      });
      if (res.ok) sent++;
    }
    totalEmailsSent += sent;
    perCohortSummary.push({
      cohort: c.name,
      enrolled,
      checkins: checkins?.length ?? 0,
      activeStudents,
      sent,
    });
  }

  return NextResponse.json({
    ok: true,
    weekRange,
    weekStart: previousMonday,
    currentWeekStart: currentMonday,
    cohortsProcessed: cohorts?.length ?? 0,
    totalEmailsSent,
    perCohort: perCohortSummary,
  });
}
