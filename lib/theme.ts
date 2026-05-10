import { cookies } from "next/headers";
import type { Theme } from "@/lib/types";

export const THEME_COOKIE = "sparkline_theme";

/** Read the user's theme from the cookie set on login / settings save. */
export function getThemeFromCookie(): Theme {
  try {
    const c = cookies().get(THEME_COOKIE)?.value;
    if (c === "light") return "light";
  } catch {}
  return "dark";
}

/** Compute the html className for the given theme. Marketing pages can
 * skip this and stay forced-dark by hardcoding `dark` themselves. */
export function htmlClassForTheme(theme: Theme): string {
  return theme === "light" ? "theme-light" : "dark";
}
