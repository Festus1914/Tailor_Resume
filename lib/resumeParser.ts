export type LineType =
  | "name"
  | "title"
  | "contact"
  | "linkedin"
  | "section"
  | "job-header"
  | "date-line"
  | "bullet"
  | "skill-category"
  | "skill-items"
  | "paragraph"
  | "blank";

export interface ParsedLine {
  type: LineType;
  text: string;
}

const SECTION_HEADER_REGEX = /^[A-Z][A-Z0-9 &/,.'-]{2,40}$/;
const DATE_LINE_REGEX =
  /(\d{1,2}\/\d{4}|\b(19|20)\d{2}\b).{0,20}(-|–|to).{0,25}(\d{1,2}\/\d{4}|\b(19|20)\d{2}\b|present)/i;
const CONTACT_REGEX = /@|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i;
const LINKEDIN_REGEX = /linkedin\.com|^https?:\/\//i;

export function parseResumeLines(text: string): ParsedLine[] {
  const rawLines = text.split("\n").map((l) => l.trim());
  const result: ParsedLine[] = [];
  let seenSection = false;
  let currentSection = "";
  let headerLineCount = 0;
  let skillsAwaitingItems = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (line === "") {
      result.push({ type: "blank", text: "" });
      continue;
    }

    // Header block: name / title / contact / (optional) linkedin — before the first section header
    if (!seenSection) {
      if (SECTION_HEADER_REGEX.test(line) && line.length < 40) {
        seenSection = true;
        currentSection = line;
        result.push({ type: "section", text: line });
        continue;
      }
      if (headerLineCount === 0) {
        result.push({ type: "name", text: line });
        headerLineCount++;
        continue;
      }
      if (headerLineCount === 1) {
        result.push({ type: "title", text: line });
        headerLineCount++;
        continue;
      }
      if (headerLineCount === 2 && CONTACT_REGEX.test(line)) {
        result.push({ type: "contact", text: line });
        headerLineCount++;
        continue;
      }
      if (headerLineCount === 3 && LINKEDIN_REGEX.test(line)) {
        result.push({ type: "linkedin", text: line });
        headerLineCount++;
        continue;
      }
      result.push({ type: "paragraph", text: line });
      continue;
    }

    // Body: after the first section header
    if (SECTION_HEADER_REGEX.test(line) && line.length < 40) {
      currentSection = line;
      skillsAwaitingItems = false;
      result.push({ type: "section", text: line });
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      result.push({ type: "bullet", text: line.replace(/^[-•]\s*/, "") });
      continue;
    }

    if (DATE_LINE_REGEX.test(line)) {
      result.push({ type: "date-line", text: line });
      continue;
    }

    // SKILLS section: alternating "Category Name" line, then comma-separated items line
    if (/^skills$/i.test(currentSection)) {
      if (!skillsAwaitingItems) {
        result.push({ type: "skill-category", text: line });
        skillsAwaitingItems = true;
      } else {
        result.push({ type: "skill-items", text: line });
        skillsAwaitingItems = false;
      }
      continue;
    }

    // A plain line immediately followed by a date-line is a job/education header
    const next = rawLines[i + 1] ?? "";
    if (DATE_LINE_REGEX.test(next)) {
      result.push({ type: "job-header", text: line });
      continue;
    }

    result.push({ type: "paragraph", text: line });
  }

  return result;
}

// Splits inline **bold** markdown into styled segments, e.g.
// "Built **RAG pipelines** using Python" -> [{text:"Built "},{text:"RAG pipelines",bold:true},{text:" using Python"}]
export interface TextSegment {
  text: string;
  bold: boolean;
}

export function parseInlineSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  if (segments.length === 0) {
    segments.push({ text, bold: false });
  }
  return segments;
}

// "Senior Software Engineer, Meta Inc" -> { title: "Senior Software Engineer", company: "Meta Inc" }
export function splitJobHeader(text: string): { title: string; company: string } {
  const idx = text.lastIndexOf(",");
  if (idx === -1) return { title: text, company: "" };
  return { title: text.slice(0, idx).trim(), company: text.slice(idx + 1).trim() };
}

// "08/2018 - Present | Menlo Park, CA" -> { dates: "08/2018 - Present", location: "Menlo Park, CA" }
export function splitDateLine(text: string): { dates: string; location: string } {
  const idx = text.indexOf("|");
  if (idx === -1) return { dates: text.trim(), location: "" };
  return { dates: text.slice(0, idx).trim(), location: text.slice(idx + 1).trim() };
}

// Contact line "phone | email | location" -> ["phone", "email", "location"]
export function splitContactLine(text: string): string[] {
  return text
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
}
