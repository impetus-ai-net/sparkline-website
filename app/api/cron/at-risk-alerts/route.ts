import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { Templates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { isoWeekStart, mondayOf } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEKS_SILENT_THRESHOLD = 2;

/**
 * Weekly at-risk digest.
 *
 * Definition: an "at-risk" student is enrolled in an active cohort,
 * has no `student_checkins` row for either the current ISO week or
 * the previous one (2+ consecutive weeks silent). The threshold
 * matches the Pulse dashboard and cohort-health page so admins see a
 * consistent definition across surfaces.
 *
 * Routes the alert to:
 *   - The assigned mentor (mentor_assignments.mentor_id), one digest
 *     per mentor with their slice of at-risk students.
 *   - Cohort admins (any user with role=admin), one digest per cohort
 *     covering the whole cohort. Admins get an overview; mentors get
 *     a personalized list of just their assignees.
 *
 * Designed to run Mondays at 15:00 UTC so it lands before the active
 * week kicks off and a mentor can intervene before another week of
 * silence accrues.
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

  const currentWeek = isoWeekStart(new Date());
  const previousWeek = (() => {
    const d = new Date(currentWeek);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  // We need check-ins from the last N weeks to count how many weeks
  // each student has been silent (capped at 8 for the message body).
  const horizonWeek = (() => {
    const d = mondayOf(new Date());
    d.setUTCDate(d.getUTCDate() - 7 * 8);
    return d.toISOString().slice(0, 10);
  })();

  const { data: activeCohorts } = await admin
    .from("cohorts")
    .select("id, name")
    .eq("status", "active");
  if (!activeCohorts || activeCohorts.length === 0) {
    return NextResponse.json({
      ok: true,
      activeCohorts: 0,
      message: "No active cohorts; nothing to do.",
    });
  }

  const cohortIds = activeCohorts.map((c) => c.id);
  const cohortNameById = new Map(activeCohorts.map((c) => [c.id, c.name]));

  const [
    { data: enrollments },
    { data: recentCheckins },
    { data: assignments },
    { data: admins },
  ] = await Promise.all([
    admin
      .from("enrollments")
      .select(
        "user_id, cohort_id, profile:profiles!enrollments_user_id_fkey(full_name, email)",
      )
      .in("cohort_id", cohortIds),
    admin
      .from("student_checkins")
      .select("user_id, week_start")
      .gte("week_start", horizonWeek)
      .in("cohort_id", cohortIds),
    admin
      .from("mentor_assignments")
      .select(
        "mentor_id, student_id, cohort_id, mentor:profiles!mentor_assignments_mentor_id_fkey(full_name, email)",
      )
      .in("cohort_id", cohortIds),
    admin.from("profiles").select("id, full_name, email").eq("role", "admin"),
  ]);

  // Index check-ins by user + week so we can ask "did this user check
  // in during the last 2 weeks?" in O(1).
  const checkinByUser = new Map<string, Set<string>>();
  for (const c of recentCheckins ?? []) {
    const set = checkinByUser.get(c.user_id) ?? new Set<string>();
    set.add(c.week_start);
    checkinByUser.set(c.user_id, set);
  }

  // Compute weeks-silent count for each student. Walk back from
  // currentWeek and count consecutive weeks with no check-in (cap at
  // 8). Anyone with 2+ consecutive silent weeks lands in the at-risk
  // bucket — matches WEEKS_SILENT_THRESHOLD.
  function weeksSilent(userId: string): number {
    const checkins = checkinByUser.get(userId) ?? new Set();
    let count = 0;
    for (let i = 0; i < 8; i++) {
      const d = new Date(currentWeek);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      if (checkins.has(key)) break;
      count++;
    }
    return count;
  }

  type Flag = {
    studentId: string;
    name: string;
    email: string | null;
    cohortId: string;
    cohortName: string | null;
    weeksSilent: number;
  };

  // Build per-mentor and per-cohort buckets in one pass.
  const flagsByMentor = new Map<string, Flag[]>();
  const flagsByCohort = new Map<string, Flag[]>();
  const mentorByStudent = new Map<string, string>(); // student_id -> mentor_id
  const mentorMeta = new Map<
    string,
    { name: string | null; email: string | null }
  >();
  for (const a of (assignments ?? []) as any[]) {
    mentorByStudent.set(a.student_id, a.mentor_id);
    const mentorProfile = Array.isArray(a.mentor) ? a.mentor[0] : a.mentor;
    if (mentorProfile && a.mentor_id) {
      mentorMeta.set(a.mentor_id, {
        name: mentorProfile.full_name ?? null,
        email: mentorProfile.email ?? null,
      });
    }
  }

  let totalFlagged = 0;
  for (const e of (enrollments ?? []) as any[]) {
    const silent = weeksSilent(e.user_id);
    if (silent < WEEKS_SILENT_THRESHOLD) continue;
    const profile = Array.isArray(e.profile) ? e.profile[0] : e.profile;
    if (!profile) continue;
    totalFlagged++;
    const flag: Flag = {
      studentId: e.user_id,
      name: profile.full_name ?? profile.email ?? e.user_id.slice(0, 8),
      email: profile.email ?? null,
      cohortId: e.cohort_id,
      cohortName: cohortNameById.get(e.cohort_id) ?? null,
      weeksSilent: silent,
    };
    const cohortBucket = flagsByCohort.get(e.cohort_id) ?? [];
    cohortBucket.push(flag);
    flagsByCohort.set(e.cohort_id, cohortBucket);
    const mentorId = mentorByStudent.get(e.user_id);
    if (mentorId) {
      const mBucket = flagsByMentor.get(mentorId) ?? [];
      mBucket.push(flag);
      flagsByMentor.set(mentorId, mBucket);
    }
  }

  let mentorEmailsSent = 0;
  for (const [mentorId, flags] of flagsByMentor) {
    const meta = mentorMeta.get(mentorId);
    if (!meta?.email) continue;
    const sorted = [...flags].sort((a, b) => b.weeksSilent - a.weeksSilent);
    const t = Templates.atRiskDigest({
      recipientName: meta.name ?? null,
      scope: "mentor",
      cohortName: null,
      students: sorted.map((f) => ({
        name: f.name,
        cohortName: f.cohortName,
        mentorName: null,
        weeksSilent: f.weeksSilent,
      })),
    });
    const res = await sendEmail({
      to: meta.email,
      subject: t.subject,
      html: t.html,
    });
    if (res.ok) mentorEmailsSent++;
  }

  let adminEmailsSent = 0;
  for (const a of (admins ?? []) as any[]) {
    if (!a.email) continue;
    // Each admin gets one email per active cohort that has flags.
    for (const [cohortId, flags] of flagsByCohort) {
      const sorted = [...flags].sort((x, y) => y.weeksSilent - x.weeksSilent);
      const t = Templates.atRiskDigest({
        recipientName: a.full_name ?? null,
        scope: "admin",
        cohortName: cohortNameById.get(cohortId) ?? null,
        students: sorted.map((f) => {
          const mentorId = mentorByStudent.get(f.studentId);
          const mentor = mentorId ? mentorMeta.get(mentorId) : null;
          return {
            name: f.name,
            cohortName: f.cohortName,
            mentorName: mentor?.name ?? null,
            weeksSilent: f.weeksSilent,
          };
        }),
      });
      const res = await sendEmail({
        to: a.email,
        subject: t.subject,
        html: t.html,
      });
      if (res.ok) adminEmailsSent++;
    }
  }

  return NextResponse.json({
    ok: true,
    currentWeek,
    previousWeek,
    activeCohorts: activeCohorts.length,
    totalFlagged,
    mentorsNotified: flagsByMentor.size,
    mentorEmailsSent,
    adminEmailsSent,
  });
}
