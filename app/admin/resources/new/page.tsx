import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ResourceForm } from "../resource-form";

export const metadata = { title: "New resource · Admin" };

export default async function NewResourcePage() {
  const admin = createAdminClient();
  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id, name")
    .order("starts_on");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/resources"
        className="text-sm text-white/55 hover:text-white"
      >
        ← Resources
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">New resource</h1>
      <Card className="mt-6">
        <ResourceForm
          initial={{
            cohort_id: null,
            category: "general",
            title: "",
            description: "",
            storage_path: null,
            external_url: null,
            size_bytes: null,
            mime_type: null,
          }}
          cohorts={cohorts ?? []}
        />
      </Card>
    </div>
  );
}
