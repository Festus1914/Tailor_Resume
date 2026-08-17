import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { requireAdmin } from "@/lib/auth/guards";
import { serializeUser } from "@/lib/auth/session";
import AdminUserTable from "@/components/admin/AdminUserTable";

export const metadata: Metadata = { title: "Users — Resume Tailor Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * User management.
 *
 * The first page of data is read directly from the database here rather than by
 * the client calling its own API on mount — that avoids a visible empty state on
 * every load. Filtering and pagination afterwards go through /api/admin/users,
 * which re-checks admin authorization on every call.
 */
export default async function AdminUsersPage() {
  // Redundant with the layout guard by design: this page reads user records, so
  // it verifies its own authorization rather than depending on a parent to have
  // done it.
  const { user: actor } = await requireAdmin();
  await connectToDatabase();

  const [users, total, pendingCount] = await Promise.all([
    User.find({}).sort({ createdAt: -1 }).limit(PAGE_SIZE),
    User.countDocuments({}),
    User.countDocuments({ status: "pending" }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-ink mb-1">Users</h1>
        <p className="text-sm text-black/50">
          Approve, reject, disable, and manage accounts.
          {pendingCount > 0 && (
            <>
              {" "}
              <span className="text-accent font-medium">
                {pendingCount} waiting for approval.
              </span>
            </>
          )}
        </p>
      </header>

      <AdminUserTable
        initialUsers={users.map(serializeUser)}
        initialTotal={total}
        initialPendingCount={pendingCount}
        pageSize={PAGE_SIZE}
        currentUserId={String(actor._id)}
      />
    </div>
  );
}
