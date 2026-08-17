"use client";

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import type { ITailoredResume } from "@/lib/models";
import type { IJob } from "@/lib/models";

interface TailorResultsViewProps {
  tailored: ITailoredResume;
  job: IJob;
}

type Tab = "resume" | "coverLetter" | "analysis";

export default function TailorResultsView({
  tailored,
  job,
}: TailorResultsViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("resume");

  const matchScore = tailored.analysis?.matchScore || 0;
  const matchColor =
    matchScore >= 80
      ? "text-accent"
      : matchScore >= 60
        ? "text-[#8a6d1f]"
        : "text-[#b3452c]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-black/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-ink">
              {job.title}
            </h2>
            <p className="text-black/60">at {job.company}</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${matchColor}`}>
              {matchScore}%
            </div>
            <p className="text-xs text-black/40">Match Score</p>
          </div>
        </div>

        <button className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2">
          <Download size={14} />
          Export as PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
        <div className="flex border-b border-black/10">
          <button
            onClick={() => setActiveTab("resume")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "resume"
                ? "text-accent border-b-2 border-accent -mb-[2px]"
                : "text-black/60 hover:text-black"
            }`}
          >
            Tailored Resume
          </button>
          <button
            onClick={() => setActiveTab("coverLetter")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "coverLetter"
                ? "text-accent border-b-2 border-accent -mb-[2px]"
                : "text-black/60 hover:text-black"
            }`}
          >
            Cover Letter
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "analysis"
                ? "text-accent border-b-2 border-accent -mb-[2px]"
                : "text-black/60 hover:text-black"
            }`}
          >
            Analysis
          </button>
        </div>

        <div className="p-6">
          {activeTab === "resume" && (
            <ResumePreview resume={tailored.current?.resume} />
          )}
          {activeTab === "coverLetter" && (
            <CoverLetterPreview
              coverLetter={tailored.current?.coverLetter || ""}
            />
          )}
          {activeTab === "analysis" && (
            <AnalysisView analysis={tailored.analysis} />
          )}
        </div>
      </div>

      {/* Token usage info */}
      <div className="text-xs text-black/40 text-center">
        Generated with {tailored.usage?.inputTokens || 0} input tokens,{" "}
        {tailored.usage?.outputTokens || 0} output tokens
      </div>
    </div>
  );
}

function ResumePreview({ resume }: { resume: any }) {
  if (!resume) return <p className="text-black/40">No resume generated</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="text-center pb-4 border-b border-black/10">
        <h1 className="text-xl font-bold">{resume.header?.fullName}</h1>
        {resume.header?.headline && (
          <p className="text-sm text-black/60">{resume.header.headline}</p>
        )}
        {(resume.header?.email ||
          resume.header?.phone ||
          resume.header?.location) && (
          <p className="text-xs text-black/40">
            {[resume.header.email, resume.header.phone, resume.header.location]
              .filter(Boolean)
              .join(" | ")}
          </p>
        )}
      </div>

      {/* Summary */}
      {resume.summary && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-1">
            Professional Summary
          </h2>
          <p className="text-sm text-black/70">{resume.summary}</p>
        </div>
      )}

      {/* Experience */}
      {resume.experience?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Experience
          </h2>
          {resume.experience.map((exp: any, idx: number) => (
            <div key={idx} className="mb-3 pb-3 border-b border-black/5 last:border-0">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-sm">{exp.title}</p>
                  <p className="text-xs text-black/60">{exp.company}</p>
                </div>
                <p className="text-xs text-black/40 whitespace-nowrap">
                  {exp.startDate} -{" "}
                  {exp.isCurrent ? "Present" : exp.endDate}
                </p>
              </div>
              {exp.bullets?.map((bullet: string, bidx: number) => (
                <p key={bidx} className="text-sm text-black/70 mt-1">
                  • {bullet}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {resume.skills?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Skills
          </h2>
          {resume.skills.map((group: any, idx: number) => (
            <p key={idx} className="text-sm text-black/70 mb-1">
              <span className="font-medium">{group.label}:</span>{" "}
              {group.items?.join(", ")}
            </p>
          ))}
        </div>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Education
          </h2>
          {resume.education.map((edu: any, idx: number) => (
            <div key={idx} className="mb-2 pb-2 border-b border-black/5 last:border-0">
              <p className="font-medium text-sm">
                {edu.degree} in {edu.field}
              </p>
              <p className="text-xs text-black/60">{edu.school}</p>
              {edu.location && (
                <p className="text-xs text-black/40">{edu.location}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverLetterPreview({ coverLetter }: { coverLetter: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      {coverLetter ? (
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-black/70 whitespace-pre-wrap leading-relaxed">
            {coverLetter}
          </p>
        </div>
      ) : (
        <p className="text-black/40">No cover letter generated</p>
      )}
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: any }) {
  if (!analysis) return <p className="text-black/40">No analysis available</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Match Score */}
      <div className="p-4 bg-accentLight rounded-lg">
        <p className="text-xs uppercase tracking-wide text-black/40 font-medium mb-2">
          Overall Match
        </p>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-accent">
            {analysis.matchScore}%
          </div>
          <p className="text-sm text-black/60">Match with job requirements</p>
        </div>
      </div>

      {/* Matched Keywords */}
      {analysis.matchedKeywords?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            ✓ Matched Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.matchedKeywords.map(
              (keyword: string, idx: number) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-accentLight text-accent border border-accent/20"
                >
                  {keyword}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Missing Keywords */}
      {analysis.missingKeywords?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Not Yet Covered
          </h3>
          <p className="text-xs text-black/60 mb-2">
            These job requirements aren't yet reflected in your resume.
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.missingKeywords.map(
              (keyword: string, idx: number) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#fdf1ea] text-[#b3452c] border border-[#b3452c]/20"
                >
                  {keyword}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Summary of Changes */}
      {analysis.summaryOfChanges?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Changes Made
          </h3>
          <ul className="space-y-2">
            {analysis.summaryOfChanges.map(
              (change: string, idx: number) => (
                <li
                  key={idx}
                  className="text-sm text-black/70 flex gap-2"
                >
                  <span className="text-accent">✓</span>
                  {change}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
