"use client";

import { useState } from "react";
import { FileEdit } from "lucide-react";
import ResumeForm from "@/components/ResumeForm";
import MatchScore from "@/components/MatchScore";
import ResultsTabs from "@/components/ResultsTabs";
import { TailorResult } from "@/lib/types";

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResult | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          applicantName: applicantName || undefined,
          companyName: companyName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 text-accent mb-3">
            <FileEdit size={22} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ink mb-2">
            Resume Tailor
          </h1>
          <p className="text-black/50 max-w-xl mx-auto text-sm sm:text-base">
            Paste your resume and a job description. Get a rewritten,
            ATS-aware resume, a match score, and a ready-to-send cover
            letter — in seconds.
          </p>
        </header>

        <div className="space-y-6">
          <ResumeForm
            resumeText={resumeText}
            jobDescription={jobDescription}
            applicantName={applicantName}
            companyName={companyName}
            loading={loading}
            onResumeChange={setResumeText}
            onJobChange={setJobDescription}
            onNameChange={setApplicantName}
            onCompanyChange={setCompanyName}
            onSubmit={handleSubmit}
          />

          {error && (
            <div className="bg-[#fdf1ea] border border-[#b3452c]/20 text-[#b3452c] text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-white border border-black/10 rounded-2xl p-10 text-center">
              <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-black/50">
                Reading the job description and reworking your resume...
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              <MatchScore
                score={result.matchScore}
                matchedKeywords={result.matchedKeywords}
                missingKeywords={result.missingKeywords}
              />
              <ResultsTabs
                result={result}
                applicantName={applicantName}
                companyName={companyName}
                onResumeChange={(text) =>
                  setResult((r) => (r ? { ...r, tailoredResume: text } : r))
                }
                onCoverLetterChange={(text) =>
                  setResult((r) => (r ? { ...r, coverLetter: text } : r))
                }
              />
            </>
          )}
        </div>

        <footer className="mt-14 text-center text-xs text-black/30">
          Nothing you enter is stored — everything lives only in this
          browser session.
          <br />
          <span className="opacity-40">build-marker: v3-safe-arrays</span>
        </footer>
      </div>
    </main>
  );
}
