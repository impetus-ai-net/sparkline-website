import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesToSet = {
  name: string;
  value: string;
  options: CookieOptions;
}[];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not put logic between createServerClient and getUser().
  // getUser() also refreshes the session if needed, which writes new cookies
  // onto `response` via setAll above. Any redirect we return must carry
  // those cookies forward or the user will be silently logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const protectedPath =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/apply");
  const authPath = path === "/login" || path === "/signup";

  function redirectTo(pathname: string, search?: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search ?? "";
    const redirect = NextResponse.redirect(url);
    // Carry over any auth cookies that getUser() may have refreshed,
    // otherwise the session is dropped on every redirect.
    response.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  if (protectedPath && !user) {
    return redirectTo("/login", `?next=${encodeURIComponent(path)}`);
  }

  if (authPath && user) {
    return redirectTo("/dashboard");
  }

  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || (profile.role !== "admin" && profile.role !== "teacher")) {
      return redirectTo("/dashboard");
    }
  }

  return response;
}
