import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Job, Profile, TailoredResume } from "@/lib/models";
import { route, notFound, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { tailorResume } from "@/lib/tailor/engine";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tailorRequestSchema = z.object({
  jobId: z.string().refine((id) => mongoose.isValidObjectId(id), {
    message: "Invalid job ID",
  }),
});

export const POST = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const body = await req.json().catch(() => ({}));
  const { jobId } = tailorRequestSchema.parse(body);

  // Fetch the job
  const job = await Job.findOne({
    _id: jobId,
    userId: user._id,
  });

  if (!job) {
    throw notFound("Job not found");
  }

  // Fetch the user's master resume
  const profile = await Profile.findOne({ userId: user._id });
  if (!profile) {
    throw badRequest(
      "Please create a master resume first in your profile."
    );
  }

  // Check if profile is tailorable
  if (!profile.isTailorable()) {
    throw badRequest(
      "Your resume needs at least a name and one job title to tailor."
    );
  }

  // Check if already tailored for this job
  const existing = await TailoredResume.findOne({
    userId: user._id,
    jobId: job._id,
  });

  if (existing) {
    return NextResponse.json({
      tailoredResume: existing,
      isNew: false,
    });
  }

  // Generate tailored resume
  const result = await tailorResume(profile.masterResume, job);

  // Save to database
  const tailored = await TailoredResume.create({
    userId: user._id,
    jobId: job._id,
    batchId: null,
    jobSnapshot: {
      title: job.title,
      company: job.company,
      url: job.url,
    },
    profileSnapshot: profile.masterResume,
    generated: {
      resume: result.resume,
      coverLetter: result.coverLetter,
    },
    current: {
      resume: result.resume,
      coverLetter: result.coverLetter,
    },
    analysis: result.analysis,
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    usage: result.usage,
    isEdited: false,
    editedAt: null,
  });

  return NextResponse.json(
    {
      tailoredResume: tailored,
      isNew: true,
    },
    { status: 201 }
  );
});

/**
 * GET /api/tailor/single?jobId=xxx
 * Fetch an existing tailored resume for a job.
 */
export const GET = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId || !mongoose.isValidObjectId(jobId)) {
    throw badRequest("Invalid job ID");
  }

  const tailored = await TailoredResume.findOne({
    userId: user._id,
    jobId,
  });

  if (!tailored) {
    throw notFound("Tailored resume not found");
  }

  return NextResponse.json({ tailoredResume: tailored });
});
