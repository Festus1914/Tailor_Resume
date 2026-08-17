import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { TailoredResume, Job } from "@/lib/models";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resumeListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  company: z.string().trim().max(100).default(""),
  status: z.enum(["all", "edited", "unedited"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["recent", "oldest", "match"]).default("recent"),
});

/**
 * GET /api/resumes
 * List user's tailored resumes with search and filtering.
 */
export const GET = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const { search, company, status, page, limit, sort } = resumeListSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams)
  );

  const filter: Record<string, unknown> = { userId: user._id };

  // Search in job title and company
  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { "jobSnapshot.title": pattern },
      { "jobSnapshot.company": pattern },
    ];
  }

  // Filter by company
  if (company) {
    filter["jobSnapshot.company"] = new RegExp(
      company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
  }

  // Filter by edit status
  if (status === "edited") {
    filter.isEdited = true;
  } else if (status === "unedited") {
    filter.isEdited = false;
  }

  // Sorting
  let sortOrder: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === "oldest") {
    sortOrder = { createdAt: 1 };
  } else if (sort === "match") {
    sortOrder = { "analysis.matchScore": -1 };
  }

  const [resumes, total] = await Promise.all([
    TailoredResume.find(filter)
      .sort(sortOrder as any)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "jobSnapshot analysis isEdited createdAt updatedAt editedAt model usage"
      ),
    TailoredResume.countDocuments(filter),
  ]);

  return NextResponse.json({
    resumes: resumes.map((r) => ({
      id: String(r._id),
      job: r.jobSnapshot,
      matchScore: r.analysis?.matchScore || 0,
      isEdited: r.isEdited,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      updatedAt: r.updatedAt,
      model: r.model,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});
