import Link from "next/link";
import { FileEdit } from "lucide-react";

/**
 * Shell for the unauthenticated pages. Deliberately has no navigation — there is
 * nowhere to go until you are signed in.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-accent mb-3"
            aria-label="Resume Tailor"
          >
            <FileEdit size={22} />
          </Link>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Resume Tailor
          </h1>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-6">
          {children}
        </div>
      </div>
    </main>
  );
}
