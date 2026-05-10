import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canUseAi } from "@/lib/access";
import { isDiscordEnabled } from "@/lib/discord";
import { StudentSidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const [aiAccess, discordEnabled] = await Promise.all([
    canUseAi(profile.role),
    isDiscordEnabled(),
  ]);

  return (
    <div className="flex min-h-screen bg-black text-white md:flex-row flex-col">
      <StudentSidebar
        role={profile.role}
        aiAccess={aiAccess}
        discordEnabled={discordEnabled}
      />
      <div className="flex flex-1 flex-col">
        <MobileNav
          kind="student"
          role={profile.role}
          aiAccess={aiAccess}
          discordEnabled={discordEnabled}
        />
        <main className="flex-1 px-5 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
