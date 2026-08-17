import { NextResponse, type NextRequest } from "next/server";
import type { FilterQuery } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { AuditLog, type IAuditLog } from "@/lib/models";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditFilterSchema = z.object({
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = route(async (req: NextRequest) => {
  await requireAdmin();
  await connectToDatabase();

  const { action, page, limit } = auditFilterSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams)
  );

  const filter: FilterQuery<IAuditLog> = {};
  if (action) filter.action = action;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("actorId", "name email")
      .populate("targetUserId", "name email")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});
