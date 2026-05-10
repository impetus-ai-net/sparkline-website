"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSelf } from "@/lib/server-guards";
import { THEME_COOKIE } from "@/lib/theme";
import type { Theme } from "@/lib/types";

export async function setTheme(theme: Theme) {
  if (theme !== "light" && theme !== "dark") {
    throw new Error("Invalid theme");
  }
  const { userId } = await assertSelf();

  // Cookie so SSR layouts pick it up immediately on the next request.
  cookies().set(THEME_COOKIE, theme, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });

  // Persist to profile so it follows the user across devices.
  const admin = createAdminClient();
  await admin.from("profiles").update({ theme }).eq("id", userId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}
