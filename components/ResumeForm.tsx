"use client";

import { Sparkles } from "lucide-react";

interface ResumeFormProps {
  resumeText: string;
  jobDescription: string;
  applicantName: string;
  companyName: string;
  loading: boolean;
  onResumeChange: (v: string) => void;
  onJobChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onCompanyChange: (v: string) => void;
  onSubmit: () => void;
}

export default function ResumeForm({
  resumeText,
  jobDescription,
  applicantName,
  companyName,
  loading,
  onResumeChange,
  onJobChange,
  onNameChange,
  onCompanyChange,
  onSubmit,
}: ResumeFormProps) {
  const canSubmit = resumeText.trim().length > 30 && jobDescription.trim().length > 30 && !loading;

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Your name (optional)
          </label>
          <input
            value={applicantName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Jane Doe"
            className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Company (optional)
          </label>
          <input
            value={companyName}
            onChange={(e) => onCompanyChange(e.target.value)}
            placeholder="Acme Corp"
            className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Your current resume
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => onResumeChange(e.target.value)}
            placeholder="Paste your resume text here..."
            className="w-full h-64 resize-none text-sm leading-relaxed bg-[#fcfcfb] border border-black/10 rounded-xl p-3.5 focus:border-accent transition-colors custom-scroll"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Target job description
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => onJobChange(e.target.value)}
            placeholder="Paste the job posting here..."
            className="w-full h-64 resize-none text-sm leading-relaxed bg-[#fcfcfb] border border-black/10 rounded-xl p-3.5 focus:border-accent transition-colors custom-scroll"
          />
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles size={16} />
        {loading ? "Tailoring your resume..." : "Tailor my resume"}
      </button>
      {!canSubmit && !loading && (resumeText.length > 0 || jobDescription.length > 0) && (
        <p className="text-xs text-black/40 mt-2">
          Add a bit more detail to both fields to get a good result.
        </p>
      )}
    </div>
  );
}
