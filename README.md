# Resume Tailor

An AI-powered resume tailoring tool built with Next.js 14 (App Router). Paste your
resume and a target job description, and it will:

- Rewrite your resume to emphasize the most relevant experience for that job
- Score how well your **original** resume matched the posting
- List keywords you already cover, and ones worth adding
- Draft a tailored cover letter
- Let you edit everything inline, then export as **PDF** or **DOCX**

No login, no database — everything lives in the browser session only.

## Stack

- **Next.js 14** (App Router, Route Handlers as the backend)
- **Anthropic Claude API** (`claude-sonnet-5`) for the actual tailoring/analysis
- **docx** for Word export
- **@react-pdf/renderer** for PDF export
- **Tailwind CSS** for styling

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the env file and add your Anthropic API key (get one at
   https://console.anthropic.com/):
   ```bash
   cp .env.example .env.local
   # then edit .env.local and set ANTHROPIC_API_KEY
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## How it works

- `app/page.tsx` — the UI: input form, loading state, results (match score,
  tailored resume, cover letter, changelog).
- `app/api/tailor/route.ts` — sends your resume + the job description to
  Claude with a forced tool call, so the response comes back as structured
  JSON (tailored resume, score, keywords, cover letter) instead of free text
  that has to be parsed.
- `app/api/export/pdf/route.tsx` — renders the (possibly hand-edited) text
  into a formatted PDF using `@react-pdf/renderer`.
- `app/api/export/docx/route.ts` — same, but produces a `.docx` using the
  `docx` package.

## Customizing

- **Model**: change `MODEL` in `lib/anthropic.ts`.
- **Tailoring behavior**: edit `SYSTEM_PROMPT` in `app/api/tailor/route.ts`
  (e.g. to bias toward a specific industry, tone, or resume format).
- **Styling**: colors/fonts live in `tailwind.config.ts`.

## Deploying

Works out of the box on Vercel — just set `ANTHROPIC_API_KEY` as an
environment variable in your project settings. No database or other
services required.

## Notes on accuracy

The model is instructed not to invent employers, titles, dates, or
achievements — only to re-emphasize and re-word your real experience. Always
proofread the output before sending it anywhere.
