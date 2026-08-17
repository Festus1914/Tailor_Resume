import { NextResponse, type NextRequest } from "next/server";
import type { FilterQuery } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User, type IUser } from "@/lib/models";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { serializeUser } from "@/lib/auth/session";
import { adminUserListSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Escapes regex metacharacters in user-supplied search text.
 *
 * Without this, a query of `.*` scans everything and `(a+)+$` is a catastrophic
 * backtracking pattern the caller gets to run on the server. Search input must
 * be treated as a literal, never as a pattern.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Paginated user list for the admin dashboard. */
export const GET = route(async (req: NextRequest) => {
  await requireAdmin();
  await connectToDatabase();

  const { status, role, q, page, limit } = adminUserListSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams)
  );

  const filter: FilterQuery<IUser> = {};
  if (status !== "all") filter.status = status;
  if (role !== "all") filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ email: pattern }, { name: pattern }];
  }

  const [users, total, pendingCount] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
    // Surfaced separately so the dashboard can badge the approval queue even
    // while the operator is looking at a filtered view.
    User.countDocuments({ status: "pending" }),
  ]);

  return NextResponse.json({
    users: users.map(serializeUser),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    pendingCount,
  });
});
