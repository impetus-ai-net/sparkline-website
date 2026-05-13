// Map Supabase auth error messages/codes into plain English copy with a
// next-step hint. Supabase surfaces raw strings like "Invalid login
// credentials" or technical rate-limit codes — these don't tell a user
// what to do next. Keep this list small and only intercept the cases
// we've actually seen; fall through to the original message otherwise.

type SupabaseLikeError = { message?: string; code?: string; status?: number };

export function friendlyAuthError(err: SupabaseLikeError | null | undefined): string {
  if (!err) return "Something went wrong. Try again.";
  const code = (err.code || "").toLowerCase();
  const msg = (err.message || "").toLowerCase();

  // Common login failures
  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid email or password")
  ) {
    return "That email and password don't match. Double-check, or reset your password.";
  }
  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed")
  ) {
    return "Please verify your email first — check your inbox for the link we sent at signup.";
  }
  if (
    code === "user_already_exists" ||
    code === "user_already_registered" ||
    msg.includes("already registered") ||
    msg.includes("user already exists")
  ) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (
    code === "weak_password" ||
    msg.includes("password should be at least") ||
    msg.includes("weak password")
  ) {
    return "Pick a stronger password — at least 8 characters, mixing letters and numbers.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    err.status === 429
  ) {
    return "Too many attempts in a row. Wait a minute, then try again.";
  }
  if (
    code === "email_address_invalid" ||
    msg.includes("invalid email") ||
    msg.includes("unable to validate email")
  ) {
    return "That email doesn't look right. Check for typos.";
  }
  if (
    code === "signup_disabled" ||
    msg.includes("signups not allowed")
  ) {
    return "New signups are temporarily closed. Try again later.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Connection problem. Check your internet and try again.";
  }

  // Fall back to the raw message but sanitize the most user-hostile bits.
  return err.message || "Something went wrong. Try again.";
}
