import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { hasEnrolledMfa } from "@/lib/mfa";
import { AdminSidebar } from "@/components/admin/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { getThemeFromCookie } from "@/lib/theme";
import { ShieldAlert } from "lucide-react";

// Pages reachable WITHOUT an enrolled MFA factor. Everything else under
// /admin redirects to /admin/mfa until the admin enrolls. /auth/signout
// stays open so a locked-out admin can at least sign out cleanly.
const MFA_BYPASS_PREFIXES = ["/admin/mfa", "/auth/signout"];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  const pathname = headers().get("x-pathname") ?? "";
  const onBypassPath = MFA_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));

  // Admins must have a verified TOTP factor before reaching anything that
  // can write state. If they hit a gated page without one, bounce them to
  // the enrollment screen with a banner explaining why.
  let mfaEnrolled = true;
  if (!onBypassPath) {
    mfaEnrolled = await hasEnrolledMfa();
    if (!mfaEnrolled) {
      redirect("/admin/mfa?required=1");
    }
  } else {
    // On the bypass page we still want to know enrollment status so the
    // banner only shows when it matters.
    mfaEnrolled = await hasEnrolledMfa();
  }

  const themeClass =
    getThemeFromCookie() === "light" ? "theme-light" : "";
  return (
    <div
      className={`${themeClass} flex min-h-screen bg-black text-white md:flex-row flex-col`}
    >
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav kind="admin" role={profile.role} />
        {!mfaEnrolled && (
          <div className="border-b border-red-400/30 bg-red-400/10 px-5 py-3 md:px-10">
            <div className="mx-auto flex max-w-6xl items-start gap-3 text-sm text-red-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Two-factor auth required to use the admin panel.
                </p>
                <p className="mt-0.5 text-red-200/80">
                  Enroll a TOTP app below to unlock the rest of /admin. Any
                  admin without 2FA is a risk to every account in the program.
                </p>
              </div>
              <Link
                href="/admin/mfa"
                className="shrink-0 rounded-md border border-red-300/40 bg-red-300/10 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-300/20"
              >
                Enroll now
              </Link>
            </div>
          </div>
        )}
        <main className="flex-1 px-5 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
