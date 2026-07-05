"use client";

interface MatchScoreProps {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}

export default function MatchScore({
  score,
  matchedKeywords,
  missingKeywords,
}: MatchScoreProps) {
  const safeScore = typeof score === "number" && !Number.isNaN(score) ? score : 0;
  const safeMatched = Array.isArray(matchedKeywords) ? matchedKeywords : [];
  const safeMissing = Array.isArray(missingKeywords) ? missingKeywords : [];

  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (safeScore / 100) * circumference;

  const color =
    safeScore >= 75 ? "#2d5a4a" : safeScore >= 50 ? "#b8860b" : "#b3452c";

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center md:items-start">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#eeece7"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-serif font-bold" style={{ color }}>
            {safeScore}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-black/40">
            original match
          </span>
        </div>
      </div>

      <div className="flex-1 w-full">
        <p className="text-sm text-black/60 mb-3">
          This is how well your <span className="font-medium">original</span>{" "}
          resume matched the job description, before tailoring.
        </p>

        {safeMatched.length > 0 && (
          <div className="mb-3">
            <p className="text-xs uppercase tracking-wide text-black/40 mb-1.5">
              Already covered
            </p>
            <div className="flex flex-wrap gap-1.5">
              {safeMatched.map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-accentLight text-accent px-2.5 py-1 rounded-full border border-accent/20"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {safeMissing.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-black/40 mb-1.5">
              Worth adding
            </p>
            <div className="flex flex-wrap gap-1.5">
              {safeMissing.map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-[#fdf1ea] text-[#b3452c] px-2.5 py-1 rounded-full border border-[#b3452c]/20"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
