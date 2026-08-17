import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { safeRedirectPath } from "@/lib/safeRedirect";

export const metadata: Metadata = { title: "Sign in — Resume Tailor" };

/**
 * `?next=` is read here in the server component and validated before being
 * handed to the form, so the client never has to be trusted with it.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  return (
    <>
      <h2 className="text-sm text-black/50 mb-5">
        Sign in to your account.
      </h2>
      <AuthForm mode="login" nextPath={safeRedirectPath(searchParams.next)} />
    </>
  );
}
