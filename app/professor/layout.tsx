import { requireStaff } from "@/lib/auth";
import { ProfessorSidebar } from "@/components/professor/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaff();
  return (
    <div className="flex min-h-screen bg-black text-white md:flex-row flex-col">
      <ProfessorSidebar role={profile.role} />
      <div className="flex flex-1 flex-col">
        <MobileNav kind="professor" role={profile.role} />
        <main className="flex-1 px-5 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
