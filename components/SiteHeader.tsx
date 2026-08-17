import Link from "next/link";
import { FileEdit, Shield, User, Zap } from "lucide-react";
import LogoutButton from "./LogoutButton";
import type { PublicUser } from "@/lib/auth/session";

/**
 * Header for signed-in pages.
 *
 * The admin link is rendered conditionally for tidiness only — hiding it is not
 * access control. `/admin` is independently guarded by `requireAdmin()` in its
 * layout and in every admin route handler, so typing the URL directly gets a
 * non-admin nowhere.
 */
export default function SiteHeader({ user }: { user: PublicUser }) {
  return (
    <header className="border-b border-black/10 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-ink hover:text-accent transition-colors"
        >
          <FileEdit size={18} className="text-accent" />
          <span className="font-serif font-bold">Resume Tailor</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/batch"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors"
            title="Bulk job processing"
          >
            <Zap size={13} />
            <span className="hidden sm:inline">Batch</span>
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors"
            title="Edit your profile"
          >
            <User size={13} />
            <span className="hidden sm:inline">Profile</span>
          </Link>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-accent/20 bg-accentLight text-accent hover:bg-accent/10 transition-colors"
            >
              <Shield size={13} />
              Admin
            </Link>
          )}

          <span className="hidden sm:inline text-xs text-black/40 truncate max-w-[180px]">
            {user.name || user.email}
          </span>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
