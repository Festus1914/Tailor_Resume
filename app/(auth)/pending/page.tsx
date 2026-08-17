import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";

export const metadata: Metadata = { title: "Awaiting approval — Resume Tailor" };

/**
 * Where a correct login lands when the account is not yet approved.
 *
 * No session exists at this point — login refuses to issue one for a pending
 * account — so this page is purely informational and reads nothing from the
 * database.
 */
export default function PendingPage() {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-accentLight text-accent mb-4">
        <Clock size={20} />
      </div>

      <h2 className="text-base font-medium text-ink mb-2">
        Waiting for approval
      </h2>

      <p className="text-sm text-black/50 mb-6">
        Your account has been created, but an administrator needs to approve it
        before you can sign in. You&apos;ll be able to sign in with the same
        email and password once that happens.
      </p>

      <Link
        href="/login"
        className="inline-block text-sm text-accent hover:underline"
      >
        Try signing in again
      </Link>
    </div>
  );
}
