interface SummarySectionProps {
  summary: string;
  onChange: (summary: string) => void;
}

export default function SummarySection({
  summary,
  onChange,
}: SummarySectionProps) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-ink mb-4">Professional Summary</h2>
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
          About You
        </span>
        <textarea
          value={summary}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Brief overview of your professional background, key skills, and career goals..."
          rows={4}
          className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
        />
      </label>
      <p className="text-xs text-black/40 mt-2">{summary.length} / 2000 characters</p>
    </div>
  );
}
