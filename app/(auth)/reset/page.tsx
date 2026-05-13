"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setConfirmError(undefined);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(friendlyAuthError(error));
      setLoading(false);
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white">
        Set a new password
      </h1>
      <p className="mt-1 text-sm text-white/65">
        Choose something only you'll know. You'll stay signed in after this.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="password" required>
            New password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-required="true"
            aria-describedby="password-hint reset-error"
            error={error ? true : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id="password-hint" className="mt-1 text-xs text-white/55">
            At least 8 characters.
          </p>
        </div>
        <div>
          <Label htmlFor="confirm" required>
            Confirm password
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-required="true"
            error={confirmError}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FieldError id="confirm-error">{confirmError}</FieldError>
        </div>
        <FieldError id="reset-error">{error}</FieldError>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Save password"}
        </Button>
      </form>
    </div>
  );
}
