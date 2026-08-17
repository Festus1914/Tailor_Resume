import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { TailoredResume } from "@/lib/models";
import { route, notFound, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { z } from "zod";
import type { ResumeDocument } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateResumeSchema = z.object({
  resume: z.object({}).passthrough().optional(),
  coverLetter: z.string().max(10000).optional(),
});

/**
 * GET /api/resumes/[resumeId]
 * Get full tailored resume details.
 */
export const GET = route(async (req: NextRequest, { params }: any) => {
  const { user } = await requireUser();
  await connectToDatabase();

  if (!mongoose.isValidObjectId(params.resumeId)) {
    throw notFound("Resume not found");
  }

  const tailored = await TailoredResume.findOne({
    _id: params.resumeId,
    userId: user._id,
  });

  if (!tailored) {
    throw notFound("Resume not found");
  }

  return NextResponse.json({
    resume: {
      id: String(tailored._id),
      job: tailored.jobSnapshot,
      generated: tailored.generated,
      current: tailored.current,
      analysis: tailored.analysis,
      isEdited: tailored.isEdited,
      createdAt: tailored.createdAt,
      editedAt: tailored.editedAt,
      updatedAt: tailored.updatedAt,
      model: tailored.model,
      usage: tailored.usage,
    },
  });
});

/**
 * PATCH /api/resumes/[resumeId]
 * Update a tailored resume (edit mode).
 */
export const PATCH = route(async (req: NextRequest, { params }: any) => {
  const { user } = await requireUser();
  await connectToDatabase();

  if (!mongoose.isValidObjectId(params.resumeId)) {
    throw notFound("Resume not found");
  }

  const body = await req.json().catch(() => ({}));
  const { resume: resumeUpdate, coverLetter } = updateResumeSchema.parse(body);

  const tailored = await TailoredResume.findOne({
    _id: params.resumeId,
    userId: user._id,
  });

  if (!tailored) {
    throw notFound("Resume not found");
  }

  // Update current (user-edited) version
  if (resumeUpdate) {
    tailored.current.resume = resumeUpdate as unknown as ResumeDocument;
  }

  if (coverLetter !== undefined) {
    tailored.current.coverLetter = coverLetter;
  }

  // Mark as edited and update timestamp
  tailored.isEdited = true;
  tailored.editedAt = new Date();

  await tailored.save();

  return NextResponse.json({
    resume: {
      id: String(tailored._id),
      isEdited: tailored.isEdited,
      editedAt: tailored.editedAt,
      current: tailored.current,
    },
  });
});

/**
 * DELETE /api/resumes/[resumeId]
 * Delete a tailored resume.
 */
export const DELETE = route(async (req: NextRequest, { params }: any) => {
  const { user } = await requireUser();
  await connectToDatabase();

  if (!mongoose.isValidObjectId(params.resumeId)) {
    throw notFound("Resume not found");
  }

  const result = await TailoredResume.deleteOne({
    _id: params.resumeId,
    userId: user._id,
  });

  if (result.deletedCount === 0) {
    throw notFound("Resume not found");
  }

  return NextResponse.json({ ok: true, message: "Resume deleted" });
});
