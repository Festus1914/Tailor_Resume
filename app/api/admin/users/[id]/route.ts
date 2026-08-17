import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { route, badRequest, notFound, forbidden } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { revokeAllSessions, serializeUser } from "@/lib/auth/session";
import { adminUserActionSchema } from "@/lib/validation/auth";
import { recordAudit } from "@/lib/auth/audit";
import type { AuditAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refuses an action that would leave the system with no way in.
 *
 * Counts *other* approved admins; if there are none, the target is the last one
 * and demoting or disabling them would lock everybody out permanently, with no
 * in-app path to recovery.
 *
 * There is a narrow race here: two admins demoting each other simultaneously
 * could both pass this check. Closing it properly needs a transaction, which
 * requires a replica set — fine on Atlas, unavailable on a standalone local
 * mongod. Given the action requires two administrators acting in the same
 * instant, the check-then-write is an accepted tradeoff rather than an oversight.
 */
async function assertNotLastAdmin(targetUserId: string): Promise<void> {
  const otherAdmins = await User.countDocuments({
    _id: { $ne: targetUserId },
    role: "admin",
    status: "approved",
  });

  if (otherAdmins === 0) {
    throw badRequest(
      "This is the only active administrator. Promote another admin first."
    );
  }
}

export const PATCH = route(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user: actor } = await requireAdmin();
    await connectToDatabase();

    // Validate before querying: an arbitrary string passed to findById throws a
    // CastError, which would surface as a 500 for what is really a bad request.
    if (!mongoose.isValidObjectId(params.id)) {
      throw notFound("That account does not exist.");
    }

    const body = await req.json().catch(() => ({}));
    const action = adminUserActionSchema.parse(body);

    const target = await User.findById(params.id);
    if (!target) throw notFound("That account does not exist.");

    const isSelf = String(target._id) === String(actor._id);
    let auditAction: AuditAction;
    const auditMeta: Record<string, unknown> = {};

    switch (action.action) {
      case "approve": {
        if (target.status === "approved") {
          throw badRequest("That account is already approved.");
        }
        target.status = "approved";
        target.approvedBy = actor._id;
        target.approvedAt = new Date();
        target.rejectionReason = "";
        auditAction = "user.approved";
        break;
      }

      case "reject": {
        // Self-lockout guard: an admin rejecting their own account would revoke
        // their sessions and leave them unable to undo it.
        if (isSelf) throw forbidden("You cannot reject your own account.");
        if (target.role === "admin") await assertNotLastAdmin(String(target._id));

        target.status = "rejected";
        target.rejectionReason = action.reason;
        auditAction = "user.rejected";
        auditMeta.reason = action.reason;
        break;
      }

      case "disable": {
        if (isSelf) throw forbidden("You cannot disable your own account.");
        if (target.role === "admin") await assertNotLastAdmin(String(target._id));

        target.status = "disabled";
        auditAction = "user.disabled";
        break;
      }

      case "enable": {
        if (target.status === "approved") {
          throw badRequest("That account is already active.");
        }
        target.status = "approved";
        if (!target.approvedAt) {
          target.approvedBy = actor._id;
          target.approvedAt = new Date();
        }
        // A lockout from failed logins would otherwise survive re-enabling.
        target.failedLoginAttempts = 0;
        target.lockedUntil = null;
        auditAction = "user.enabled";
        break;
      }

      case "setRole": {
        if (target.role === action.role) {
          throw badRequest(`That account is already ${action.role}.`);
        }
        // Self-demotion is the most common way to accidentally lose all access.
        if (isSelf && action.role !== "admin") {
          throw forbidden("You cannot remove your own administrator role.");
        }
        if (target.role === "admin" && action.role !== "admin") {
          await assertNotLastAdmin(String(target._id));
        }

        auditMeta.from = target.role;
        auditMeta.to = action.role;
        target.role = action.role;
        auditAction = "user.role_changed";
        break;
      }

      case "setQuota": {
        auditMeta.from = target.quota.monthlyJobLimit;
        auditMeta.to = action.monthlyJobLimit;
        target.quota.monthlyJobLimit = action.monthlyJobLimit;
        auditAction = "user.quota_changed";
        break;
      }
    }

    await target.save();

    // Revoke sessions for any action that removes access, so open tabs stop
    // working immediately instead of at the end of their session window. This is
    // the reason sessions are stored server-side at all.
    if (target.status !== "approved") {
      auditMeta.sessionsRevoked = await revokeAllSessions(String(target._id));
    }

    await recordAudit({
      action: auditAction,
      actorId: String(actor._id),
      targetUserId: String(target._id),
      metadata: auditMeta,
      req,
    });

    return NextResponse.json({ user: serializeUser(target) });
  }
);

export const DELETE = route(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user: actor } = await requireAdmin();
    await connectToDatabase();

    if (!mongoose.isValidObjectId(params.id)) {
      throw notFound("That account does not exist.");
    }

    const target = await User.findById(params.id);
    if (!target) throw notFound("That account does not exist.");

    const isSelf = String(target._id) === String(actor._id);
    if (isSelf) throw forbidden("You cannot delete your own account.");
    if (target.role === "admin") await assertNotLastAdmin(String(target._id));

    const email = target.email;
    await User.deleteOne({ _id: target._id });
    await revokeAllSessions(String(target._id));

    await recordAudit({
      action: "user.deleted",
      actorId: String(actor._id),
      targetUserId: String(target._id),
      metadata: { email },
      req,
    });

    return NextResponse.json({ ok: true });
  }
);
