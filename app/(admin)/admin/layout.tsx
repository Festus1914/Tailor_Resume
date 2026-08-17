import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Users, Shield, BarChart3 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { getOptionalUser } from "@/lib/auth/guards";
import { serializeUser } from "@/lib/auth/session";

/**
 * Enforcement point for every admin page.
 *
 * A signed-in non-admin gets 404 rather than 403. A 403 would confirm that
 * `/admin/users` exists and is simply off-limits; 404 tells them nothing about
 * the shape of the admin surface. The API routes take the same approach.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalUser();

  if (!session) redirect("/login");
  if (session.user.role !== "admin") notFound();

  const user = serializeUser(session.user);

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader user={user} />

      {/* Admin nav tabs */}
      <nav className="border-b border-black/10 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm px-4 py-3 border-b-2 border-transparent text-black/60 hover:text-black hover:border-black/20 transition-colors"
          >
            <BarChart3 size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center gap-2 text-sm px-4 py-3 border-b-2 border-transparent text-black/60 hover:text-black hover:border-black/20 transition-colors"
          >
            <Users size={16} />
            <span className="hidden sm:inline">Users</span>
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center gap-2 text-sm px-4 py-3 border-b-2 border-transparent text-black/60 hover:text-black hover:border-black/20 transition-colors"
          >
            <Shield size={16} />
            <span className="hidden sm:inline">Audit Log</span>
          </Link>
        </div>
      </nav>

      {children}
    </div>
  );
}
