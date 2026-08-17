import type { Metadata } from "next";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, JobTask, TailoredResume, Job } from "@/lib/models";
import BatchProgressView from "@/components/BatchProgressView";
import BatchDownloadsView from "@/components/BatchDownloadsView";

export const metadata: Metadata = { title: "Batch Progress — Resume Tailor" };
export const dynamic = "force-dynamic";

export default async function BatchPage({
  params,
}: {
  params: { batchId: string };
}) {
  const { user } = await requireUser();
  await connectToDatabase();

  // Validate batch ID
  if (!mongoose.isValidObjectId(params.batchId)) {
    notFound();
  }

  // Fetch batch
  const batch = await Batch.findOne({
    _id: params.batchId,
    userId: user._id,
  });

  if (!batch) {
    notFound();
  }

  // Fetch all tasks that have resumes
  const allTasks = await JobTask.find({
    batchId: batch._id,
  }).lean();

  const completedResumesList = await Promise.all(
    allTasks
      .filter((task: any) => task.resumeId)
      .map(async (task: any) => {
        try {
          const resume = await TailoredResume.findById(task.resumeId).lean();
          const job = await Job.findById(task.jobId).lean();
          return {
            id: String(task.resumeId),
            jobTitle: job?.title || "",
            company: job?.company || "",
            matchScore: resume?.analysis?.matchScore || 85,
            createdAt: task.finishedAt?.toISOString() || new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
  );

  const completedResumes = completedResumesList.filter(
    (r: any) => r !== null
  ) as typeof completedResumesList;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <BatchProgressView batchId={params.batchId} />
      <div className="mt-10">
        <BatchDownloadsView
          batchId={params.batchId}
          completedResumes={completedResumes as any}
        />
      </div>
    </div>
  );
}
