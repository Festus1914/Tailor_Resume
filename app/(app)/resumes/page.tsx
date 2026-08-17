import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  Download,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
} from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { TailoredResume } from "@/lib/models";
import ResumeListView from "@/components/ResumeListView";

export const metadata: Metadata = {
  title: "Resume History — Resume Tailor",
};
export const dynamic = "force-dynamic";

export default async function ResumesPage({
  searchParams,
}: {
  searchParams: { q?: string; company?: string; status?: string; page?: string };
}) {
  const { user } = await requireUser();
  await connectToDatabase();

  const search = (searchParams.q || "").trim();
  const company = (searchParams.company || "").trim();
  const status = searchParams.status || "all";
  const page = Math.max(parseInt(searchParams.page || "1"), 1);

  // Build filter
  const filter: Record<string, unknown> = { userId: user._id };

  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { "jobSnapshot.title": pattern },
      { "jobSnapshot.company": pattern },
    ];
  }

  if (company) {
    filter["jobSnapshot.company"] = new RegExp(
      company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
  }

  if (status === "edited") {
    filter.isEdited = true;
  } else if (status === "unedited") {
    filter.isEdited = false;
  }

  const limit = 25;
  const [resumes, total] = await Promise.all([
    TailoredResume.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("jobSnapshot analysis isEdited createdAt editedAt model"),
    TailoredResume.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-ink mb-2">
          Resume History
        </h1>
        <p className="text-black/50">
          View, edit, and download all your tailored resumes.
        </p>
      </header>

      {/* Search and filters */}
      <ResumeListView
        resumes={resumes.map((r) => ({
          id: String(r._id),
          job: r.jobSnapshot,
          matchScore: r.analysis?.matchScore || 0,
          isEdited: r.isEdited,
          createdAt: r.createdAt,
          editedAt: r.editedAt,
          model: r.model,
        }))}
        total={total}
        page={page}
        pageSize={limit}
        totalPages={totalPages}
        currentSearch={search}
        currentCompany={company}
        currentStatus={status}
      />

      {resumes.length === 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-12 text-center">
          <Clock size={40} className="mx-auto mb-4 text-black/20" />
          <p className="text-black/60 mb-2">No resumes yet</p>
          <p className="text-sm text-black/40 mb-4">
            Tailor a job posting to create your first resume
          </p>
          <Link
            href="/jobs"
            className="text-accent hover:underline font-medium"
          >
            Add a job posting →
          </Link>
        </div>
      )}
    </div>
  );
}
