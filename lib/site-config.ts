import { createAdminClient } from "@/lib/supabase/admin";

// Single source of truth for public, admin-editable site facts (active
// cohort + branding). The admin can change anything here from
// /admin/cohorts or /admin/settings and every page that reads via these
// helpers will reflect it on the next request.

export type ActiveCohort = {
  id: string;
  name: string;
  cohortNumber: number | null;
  startsOn: string | null;
  endsOn: string | null;
  capacity: number;
  priceCents: number;
  status: string;
};

export type SiteSettings = {
  contactEmail: string;
  discordUrl: string;
  applicationsOpen: boolean;
  applicationsClosedMessage: string;
  demoDayDate: string | null;
  maintenanceMode: boolean;
};

export type SiteConfig = {
  cohort: ActiveCohort | null;
  settings: SiteSettings;
  // Derived fields for marketing surfaces.
  derived: {
    /** "Cohort 1" — falls back to "" if no number is set. */
    cohortLabel: string;
    /** "Summer 2026" — the cohort's name (season label). */
    cohortName: string;
    /** "Cohort 1 · Summer 2026" — combined label with separator. */
    cohortHeadline: string;
    /** "Jun 15 → Jul 13" — date range, or "" if dates are missing. */
    dateRangeLabel: string;
    /** "97" — integer-rounded dollar price (no $ prefix). */
    priceDollars: string;
    /** "$97" — convenience formatted price. */
    priceLabel: string;
    /** Capacity as a string, e.g. "24". */
    capacityLabel: string;
  };
};

const FALLBACK_SETTINGS: SiteSettings = {
  contactEmail: "sparkline.youth@gmail.com",
  discordUrl: "",
  applicationsOpen: true,
  applicationsClosedMessage:
    "Applications are currently closed. Check back soon for the next cohort.",
  demoDayDate: null,
  maintenanceMode: false,
};

const FALLBACK_COHORT: ActiveCohort = {
  id: "",
  name: "Summer 2026",
  cohortNumber: 1,
  startsOn: "2026-06-15",
  endsOn: "2026-07-13",
  capacity: 24,
  priceCents: 9700,
  status: "upcoming",
};

function formatDateRange(startsOn: string | null, endsOn: string | null) {
  if (!startsOn || !endsOn) return "";
  // Render in US locale, short month, no year (the cohort name carries the
  // year). Parse as UTC midnight so a 2026-06-15 string doesn't shift due
  // to the server's timezone.
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(startsOn)} → ${fmt(endsOn)}`;
}

function derive(cohort: ActiveCohort | null): SiteConfig["derived"] {
  const c = cohort ?? FALLBACK_COHORT;
  const cohortLabel =
    c.cohortNumber != null ? `Cohort ${c.cohortNumber}` : "";
  const cohortName = c.name;
  const cohortHeadline = cohortLabel
    ? `${cohortLabel} · ${cohortName}`
    : cohortName;
  const dollars = Math.round((c.priceCents ?? 0) / 100);
  return {
    cohortLabel,
    cohortName,
    cohortHeadline,
    dateRangeLabel: formatDateRange(c.startsOn, c.endsOn),
    priceDollars: String(dollars),
    priceLabel: `$${dollars}`,
    capacityLabel: String(c.capacity),
  };
}

/**
 * Resolve the public site config. Reads `site_settings` and the "active"
 * cohort (admin-pinned, or the next upcoming/active one) in a single
 * round-trip. Always returns a config — never throws — so callers don't
 * need to guard the marketing site against a Supabase outage.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  const admin = createAdminClient();

  const [settingsRes, pinnedIdRes] = await Promise.all([
    admin.from("site_settings").select("key, value"),
    // We fetch the pinned cohort id separately so the cohort row query
    // can be a single .single() call when it exists.
    admin
      .from("site_settings")
      .select("value")
      .eq("key", "active_cohort_id")
      .maybeSingle(),
  ]);

  const raw: Record<string, any> = {};
  for (const r of settingsRes.data ?? []) raw[r.key] = r.value;

  const settings: SiteSettings = {
    contactEmail:
      typeof raw.contact_email === "string"
        ? raw.contact_email
        : FALLBACK_SETTINGS.contactEmail,
    discordUrl:
      typeof raw.discord_url === "string"
        ? raw.discord_url
        : FALLBACK_SETTINGS.discordUrl,
    applicationsOpen:
      typeof raw.applications_open === "boolean"
        ? raw.applications_open
        : FALLBACK_SETTINGS.applicationsOpen,
    applicationsClosedMessage:
      typeof raw.applications_closed_message === "string"
        ? raw.applications_closed_message
        : FALLBACK_SETTINGS.applicationsClosedMessage,
    demoDayDate:
      typeof raw.demo_day_date === "string" ? raw.demo_day_date : null,
    maintenanceMode:
      typeof raw.maintenance_mode === "boolean"
        ? raw.maintenance_mode
        : FALLBACK_SETTINGS.maintenanceMode,
  };

  const pinnedId =
    typeof pinnedIdRes.data?.value === "string"
      ? (pinnedIdRes.data!.value as string)
      : null;

  // Resolve the active cohort: pinned id wins, otherwise the next
  // upcoming/active cohort by start date. We `select("*")` so the read
  // tolerates a missing `cohort_number` column — matches the pattern in
  // 0008_discord_integration where the app tolerates the migration
  // landing later than the code.
  function toCohort(data: any): ActiveCohort {
    return {
      id: data.id,
      name: data.name,
      cohortNumber:
        typeof data.cohort_number === "number" ? data.cohort_number : null,
      startsOn: data.starts_on,
      endsOn: data.ends_on,
      capacity: data.capacity,
      priceCents: data.price_cents,
      status: data.status,
    };
  }

  let cohort: ActiveCohort | null = null;
  if (pinnedId) {
    const { data } = await admin
      .from("cohorts")
      .select("*")
      .eq("id", pinnedId)
      .maybeSingle();
    if (data) cohort = toCohort(data);
  }
  if (!cohort) {
    const { data } = await admin
      .from("cohorts")
      .select("*")
      .in("status", ["upcoming", "active"])
      .order("starts_on", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data) cohort = toCohort(data);
  }

  return {
    cohort,
    settings,
    derived: derive(cohort),
  };
}
