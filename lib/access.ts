import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, ApplicationStatus } from "@/lib/types";

const ACCEPTED_STATUSES: ApplicationStatus[] = ["accepted", "paid", "enrolled"];

/**
 * Whether the current user is enrolled in any cohort. Admins are treated
 * as enrolled so they can preview enrolled-only routes; mentors and
 * investors don't reach /dashboard so the answer doesn't matter for them.
 */
export async function isEnrolled(role?: Role | null): Promise<boolean> {
  if (role === "admin") return true;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Shape returned by getStudentAccess: a single object the dashboard
 * pages can branch on to render a soft "you need to be enrolled" view
 * instead of redirecting or 500'ing the user.
 */
export type StudentAccess = {
  enrolled: boolean;
  /** Most recent application status, if any. */
  applicationStatus: ApplicationStatus | null;
  /** Role of the current user, defaulting to "student". */
  role: Role;
};

export async function getStudentAccess(
  role: Role = "student",
): Promise<StudentAccess> {
  if (role === "admin") {
    return { enrolled: true, applicationStatus: null, role };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { enrolled: false, applicationStatus: null, role };
  }
  const admin = createAdminClient();
  const [{ data: enrollment }, { data: app }] = await Promise.all([
    admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    admin
      .from("applications")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    enrolled: !!enrollment,
    applicationStatus: (app?.status as ApplicationStatus) ?? null,
    role,
  };
}

/**
 * Whether the current user is allowed to access the AI co-founder.
 * Staff always have access. Students need an application that has
 * passed admin review (accepted / paid / enrolled).
 */
export async function canUseAi(role: Role): Promise<boolean> {
  if (
    role === "admin" ||
    role === "mentor" ||
    role === "investor"
  ) {
    return true;
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: app } = await supabase
    .from("applications")
    .select("status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app) return false;
  return ACCEPTED_STATUSES.includes(app.status as ApplicationStatus);
}
