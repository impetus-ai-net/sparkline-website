import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { ThemeToggle } from "./theme-toggle";
import { Card } from "@/components/ui/card";
import type { Theme } from "@/lib/types";

export const metadata = { title: "Settings · SparkLine" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const theme: Theme = profile?.theme === "light" ? "light" : "dark";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-white/55">
        Update your profile, preferences, and account.
      </p>

      <Card className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/55">
          Appearance
        </h2>
        <p className="mb-4 text-sm text-white/60">
          Switch between light and dark mode. Applies across your dashboard
          on every device you sign in to.
        </p>
        <ThemeToggle initial={theme} />
      </Card>

      <Card className="mt-6">
        <SettingsForm
          initialFullName={profile?.full_name ?? ""}
          email={user.email ?? ""}
        />
      </Card>
    </div>
  );
}
