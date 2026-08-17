import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getOptionalUser } from "@/lib/auth/guards";
import { serializeUser } from "@/lib/auth/session";

/**
 * Shell for authenticated pages — and the enforcement point for all of them.
 *
 * `getOptionalUser()` resolves the session against the database, which means an
 * account that was disabled a second ago fails here even though its cookie is
 * still present and middleware let the request through. Middleware cannot do
 * this check (no database on the Edge runtime), so this layout is the boundary
 * that actually matters for page routes.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalUser();

  if (!session) {
    // A stale or forged cookie lands here. Sending them to /login lets the form
    // clear it and start over.
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader user={serializeUser(session.user)} />
      {children}
    </div>
  );
}
