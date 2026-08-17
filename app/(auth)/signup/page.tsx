import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create an account — Resume Tailor" };

export default function SignupPage() {
  return (
    <>
      <h2 className="text-sm text-black/50 mb-5">
        Create an account. An administrator will review it before you can sign
        in.
      </h2>
      {/* Signup never honors ?next= — a new account has no session to redirect
          with, and the bootstrap admin belongs on the home page. */}
      <AuthForm mode="signup" nextPath="/" />
    </>
  );
}
