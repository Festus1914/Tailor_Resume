import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { Job } from "@/lib/models";
import JobSubmissionForm from "@/components/JobSubmissionForm";

export const metadata: Metadata = { title: "Jobs — Resume Tailor" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { user } = await requireUser();
  await connectToDatabase();

  const [jobs, total] = await Promise.all([
    Job.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50),
    Job.countDocuments({ userId: user._id }),
  ]);

  const statusStats = {
    ok: jobs.filter((j) => j.fetchStatus === "ok").length,
    failed: jobs.filter((j) => j.fetchStatus === "failed").length,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-ink mb-2">
          Job Postings
        </h1>
        <p className="text-black/50">
          Submit job URLs to tailor your resume. We'll extract the details
          automatically.
        </p>
      </header>

      {/* Submission form */}
      <JobSubmissionForm />

      {/* Stats and list */}
      {jobs.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">Your Jobs</h2>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-accent">
                <CheckCircle size={14} />
                {statusStats.ok} extracted
              </div>
              {statusStats.failed > 0 && (
                <div className="flex items-center gap-1.5 text-[#b3452c]">
                  <AlertCircle size={14} />
                  {statusStats.failed} failed
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f6f5f2]">
                  <tr className="text-xs uppercase tracking-wide text-black/40">
                    <th className="px-4 py-3 text-left font-medium">Job</th>
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={String(job._id)}
                      className="border-t border-black/5 hover:bg-black/2 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-ink">
                            {job.title || "Untitled"}
                          </p>
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent hover:underline truncate block"
                            >
                              {job.url}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-black/60">
                          {job.company || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {job.fetchStatus === "ok" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accentLight text-accent border border-accent/20">
                            <CheckCircle size={12} />
                            Extracted
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#fdf1ea] text-[#b3452c] border border-[#b3452c]/20 mb-1">
                              <AlertCircle size={12} />
                              Failed
                            </span>
                            <p className="text-xs text-black/40">
                              {job.error}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-black/40 whitespace-nowrap">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-12 text-black/40">
          <p className="text-sm mb-4">No jobs submitted yet</p>
          <p className="text-xs">
            Start by pasting a job URL or entering details manually above.
          </p>
        </div>
      )}
    </div>
  );
}
