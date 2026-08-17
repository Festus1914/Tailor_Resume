"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface JobSubmissionProps {
  onJobSubmitted?: (jobId: string) => void;
}

type SubmitMode = "url" | "manual";

export default function JobSubmissionForm({
  onJobSubmitted,
}: JobSubmissionProps) {
  const [mode, setMode] = useState<SubmitMode>("url");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // URL mode
  const [url, setUrl] = useState("");

  // Manual mode
  const [manual, setManual] = useState({
    url: "",
    title: "",
    company: "",
    location: "",
    employmentType: "",
    descriptionText: "",
  });

  async function handleSubmitUrl() {
    if (!url.trim()) {
      setError("Please enter a job URL");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            data.warning ||
            "Failed to submit job. Please check the URL and try again."
        );
      }

      setSuccess(true);
      setUrl("");
      onJobSubmitted?.(data.job._id);

      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit job");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitManual() {
    if (!manual.title.trim() || !manual.company.trim()) {
      setError("Title and company are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit job");

      setSuccess(true);
      setManual({
        url: "",
        title: "",
        company: "",
        location: "",
        employmentType: "",
        descriptionText: "",
      });
      onJobSubmitted?.(data.job._id);

      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-ink mb-4">Add Job Posting</h2>

      {error && (
        <div className="mb-4 bg-[#fdf1ea] border border-[#b3452c]/20 text-[#b3452c] text-sm rounded-xl p-3.5 flex gap-2">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-accentLight border border-accent/20 text-accent text-sm rounded-xl p-3.5 flex gap-2">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>Job posting added successfully</span>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1 mb-6 border-b border-black/10">
        <button
          onClick={() => setMode("url")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            mode === "url"
              ? "border-accent text-accent"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Paste URL
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            mode === "manual"
              ? "border-accent text-accent"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Enter Manually
        </button>
      </div>

      {mode === "url" ? (
        <div className="space-y-4">
          <div>
            <label className="block mb-1.5">
              <span className="text-xs uppercase tracking-wide text-black/40 font-medium">
                Job URL
              </span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/careers/job-123"
              className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
              disabled={submitting}
            />
            <p className="text-xs text-black/40 mt-1.5">
              Paste a link to any job posting. We'll extract the details
              automatically.
            </p>
          </div>

          <button
            onClick={handleSubmitUrl}
            disabled={submitting}
            className="w-full bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Extracting...
              </>
            ) : (
              "Extract Job Details"
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Job Title"
              value={manual.title}
              onChange={(v) => setManual({ ...manual, title: v })}
              placeholder="Senior Software Engineer"
              required
            />
            <Field
              label="Company"
              value={manual.company}
              onChange={(v) => setManual({ ...manual, company: v })}
              placeholder="Acme Corp"
              required
            />
            <Field
              label="Location"
              value={manual.location}
              onChange={(v) => setManual({ ...manual, location: v })}
              placeholder="San Francisco, CA"
            />
            <Field
              label="Employment Type"
              value={manual.employmentType}
              onChange={(v) => setManual({ ...manual, employmentType: v })}
              placeholder="Full-time"
            />
          </div>

          <div>
            <label className="block mb-1.5">
              <span className="text-xs uppercase tracking-wide text-black/40 font-medium">
                Job Description
              </span>
            </label>
            <textarea
              value={manual.descriptionText}
              onChange={(e) =>
                setManual({ ...manual, descriptionText: e.target.value })
              }
              placeholder="Paste the full job description..."
              rows={6}
              className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
              disabled={submitting}
            />
          </div>

          <button
            onClick={handleSubmitManual}
            disabled={submitting}
            className="w-full bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              "Save Job Posting"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-black/40 font-medium mb-1.5 block">
        {label}
        {required && <span className="text-[#b3452c]">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
      />
    </label>
  );
}
