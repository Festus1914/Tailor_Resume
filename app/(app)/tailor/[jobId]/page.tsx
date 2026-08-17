import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { Job, TailoredResume } from "@/lib/models";
import TailorResultsView from "@/components/TailorResultsView";

export const metadata: Metadata = { title: "Tailor Resume — Resume Tailor" };
export const dynamic = "force-dynamic";

export default async function TailorPage({
  params,
}: {
  params: { jobId: string };
}) {
  const { user } = await requireUser();
  await connectToDatabase();

  // Validate job ID
  if (!mongoose.isValidObjectId(params.jobId)) {
    notFound();
  }

  // Fetch job
  const job = await Job.findOne({
    _id: params.jobId,
    userId: user._id,
  });

  if (!job) {
    notFound();
  }

  // Check if already tailored
  let tailored = await TailoredResume.findOne({
    userId: user._id,
    jobId: params.jobId,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {tailored ? (
        <TailorResultsView tailored={tailored} job={job} />
      ) : (
        <TailorInitialView job={job} jobId={params.jobId} />
      )}
    </div>
  );
}

function TailorInitialView({
  job,
  jobId,
}: {
  job: any;
  jobId: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-black/10 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-serif font-bold text-ink mb-2">
          {job.title}
        </h1>
        <p className="text-black/60 mb-4">at {job.company}</p>

        {job.location && (
          <p className="text-sm text-black/50 mb-4">{job.location}</p>
        )}

        {job.descriptionText && (
          <div className="mb-6">
            <h2 className="font-semibold text-sm text-ink mb-2">About This Role</h2>
            <p className="text-sm text-black/70 whitespace-pre-wrap">
              {job.descriptionText.substring(0, 500)}...
            </p>
          </div>
        )}

        {job.requirements?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-sm text-ink mb-2">Requirements</h2>
            <ul className="space-y-1">
              {job.requirements.slice(0, 5).map((req: string, idx: number) => (
                <li key={idx} className="text-sm text-black/70">
                  • {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        <TailorButton jobId={jobId} />
      </div>
    </div>
  );
}

function TailorButton({ jobId }: { jobId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        // This will be handled client-side in a real implementation
      }}
    >
      <button
        type="button"
        className="w-full bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
        onClick={async () => {
          const res = await fetch("/api/tailor/single", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });

          if (res.ok) {
            // Refresh page to show results
            window.location.reload();
          } else {
            alert("Failed to tailor resume");
          }
        }}
      >
        Generate Tailored Resume
      </button>
    </form>
  );
}
