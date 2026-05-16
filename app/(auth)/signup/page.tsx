import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up · SparkLine Youth" };

// Mirrors safeNext in app/(auth)/login/page.tsx — same-origin paths only,
// so a tampered ?next= can't trampoline the user off-site after signup.
function safeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const safe = safeNext(searchParams.next);
  const loginHref = safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
      <p className="mt-1 text-sm text-white/50">
        Sign up to apply for SparkLine Youth. Takes 30 seconds.
      </p>
      <SignupForm next={safe} />
      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href={loginHref} className="text-spark hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
