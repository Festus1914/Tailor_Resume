"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn, UserPlus } from "lucide-react";

type Mode = "login" | "signup";

interface AuthFormProps {
  mode: Mode;
  /** Validated server-side before it reaches here — see lib/safeRedirect.ts. */
  nextPath: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
  fields?: Record<string, string>;
}

export default function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { name, email, password } : { email, password }
        ),
      });

      const data = (await res.json()) as ApiErrorBody & {
        signedIn?: boolean;
        message?: string;
      };

      if (!res.ok) {
        setFieldErrors(data.fields ?? {});
        // A pending account is an expected outcome of a correct login, not a
        // failure — send them somewhere that explains the wait.
        if (data.code === "account_pending") {
          router.push("/pending");
          return;
        }

        // Provide more specific error messages for common issues
        let errorMessage = data.error ?? "Something went wrong. Please try again.";

        if (data.code === "invalid_credentials") {
          errorMessage = mode === "login"
            ? "Email or password is incorrect."
            : "An account with that email already exists.";
        } else if (data.code === "account_rejected") {
          errorMessage = "Your account request was not approved.";
        } else if (data.code === "account_disabled") {
          errorMessage = "Your account has been disabled.";
        } else if (res.status === 429) {
          errorMessage = data.error ?? "Too many login attempts. Please try again later.";
        } else if (res.status === 500) {
          errorMessage = "Server error. Please try again in a few moments.";
        }

        setError(errorMessage);

        // Log to console for debugging
        console.error("Auth error:", {
          status: res.status,
          code: data.code,
          error: data.error,
          mode,
        });
        return;
      }

      if (isSignup && !data.signedIn) {
        // Created but awaiting approval: no session was issued.
        setNotice(
          data.message ??
            "Account created. An administrator needs to approve it before you can sign in."
        );
        setPassword("");
        return;
      }

      // refresh() re-runs the server layouts so the header picks up the new
      // session before the destination renders.
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notice) {
    return (
      <div className="text-center">
        <div className="bg-accentLight border border-accent/20 text-accent text-sm rounded-xl p-4 mb-4">
          {notice}
        </div>
        <Link href="/login" className="text-sm text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="bg-[#fdf1ea] border border-[#b3452c]/20 text-[#b3452c] text-sm rounded-xl p-3.5"
        >
          {error}
        </div>
      )}

      {isSignup && (
        <Field label="Your name" error={fieldErrors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Jane Doe"
            className={inputClass(fieldErrors.name)}
          />
        </Field>
      )}

      <Field label="Email" error={fieldErrors.email}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="you@example.com"
          className={inputClass(fieldErrors.email)}
        />
      </Field>

      <Field label="Password" error={fieldErrors.password}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Tells password managers to offer generation on signup and the saved
          // credential on login, rather than autofilling the wrong one.
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          placeholder={isSignup ? "At least 12 characters" : "••••••••••••"}
          className={inputClass(fieldErrors.password)}
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isSignup ? (
          <UserPlus size={16} />
        ) : (
          <LogIn size={16} />
        )}
        {submitting
          ? isSignup
            ? "Creating account..."
            : "Signing in..."
          : isSignup
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-center text-sm text-black/50">
        {isSignup ? "Already have an account? " : "Need an account? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-accent hover:underline"
        >
          {isSignup ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}

function inputClass(error?: string): string {
  return `w-full border rounded-lg px-3 py-2.5 text-sm bg-[#fcfcfb] transition-colors ${
    error
      ? "border-[#b3452c]/50 focus:border-[#b3452c]"
      : "border-black/10 focus:border-accent"
  }`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-[#b3452c] mt-1 block">{error}</span>}
    </label>
  );
}
