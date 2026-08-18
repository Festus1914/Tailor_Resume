import Anthropic from "@anthropic-ai/sdk";

/**
 * Advanced Job Extractor with Multiple Strategies
 *
 * Strategies (in order):
 * 1. JSON-LD extraction (fastest, most reliable)
 * 2. CSS selector extraction (for popular job boards)
 * 3. Claude LLM extraction with optimized prompt
 * 4. Basic text extraction (fallback)
 */

export interface ExtractedJobData {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  description: string;
  requirements: string[];
  benefits?: string[];
  salary?: string;
  niceToHave?: string[];
  confidence: number;
  method: "jsonld" | "css" | "llm" | "basic";
}

const client = new Anthropic();

/**
 * Extract JSON-LD structured data from HTML
 */
function extractJsonLd(html: string): ExtractedJobData | null {
  try {
    const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const data = JSON.parse(match[1]);
      let jobPosting = data;

      if (data["@graph"]) {
        jobPosting = data["@graph"].find(
          (item: any) => item["@type"] === "JobPosting"
        );
      }

      if (jobPosting?.["@type"]?.includes("JobPosting")) {
        const org = jobPosting.hiringOrganization || {};
        const location = jobPosting.jobLocation || {};

        return {
          title: String(jobPosting.title || jobPosting.jobTitle || "").trim(),
          company: String(org.name || jobPosting.company || "").trim(),
          location: String(
            location.address ||
              location.addressLocality ||
              location.name ||
              ""
          ).trim(),
          employmentType: String(jobPosting.employmentType || "").trim(),
          description: String(jobPosting.description || "").trim(),
          requirements: extractRequirements(
            String(jobPosting.description || "")
          ),
          benefits: extractBenefits(String(jobPosting.description || "")),
          salary: String(
            jobPosting.baseSalary?.value?.minValue ||
              jobPosting.baseSalary ||
              ""
          ).trim(),
          confidence: 0.95,
          method: "jsonld",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("JSON-LD extraction failed:", error);
    return null;
  }
}

/**
 * Extract using CSS selectors for popular job boards
 */
function extractByCssSelectors(html: string): ExtractedJobData | null {
  try {
    // Simple text extraction for common patterns
    const patterns = {
      title: [
        /<h1[^>]*>([^<]+)<\/h1>/,
        /<h2[^>]*>([^<]+)<\/h2>/,
        /job.?title[:\s]+([^\n<]+)/i,
      ],
      company: [
        /company[:\s]+([^\n<]+)/i,
        /<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)/i,
        /by\s+([^\n<,]+)/i,
      ],
      location: [
        /location[:\s]+([^\n<]+)/i,
        /based[:\s]+([^\n<]+)/i,
        /in\s+([^\n<,]+)/i,
      ],
    };

    const title = extractPattern(html, patterns.title);
    const company = extractPattern(html, patterns.company);
    const location = extractPattern(html, patterns.location);
    const description = html.substring(0, 5000);

    if (!title && !company) return null;

    return {
      title: title || "Job Title",
      company: company || "Company",
      location: location || "Location",
      employmentType: "Full-time",
      description,
      requirements: extractRequirements(description),
      confidence: 0.6,
      method: "css",
    };
  } catch {
    return null;
  }
}

/**
 * Extract pattern from HTML
 */
function extractPattern(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 200);
    }
  }
  return "";
}

/**
 * Extract using Claude LLM with optimized prompt
 */
async function extractWithLLM(html: string): Promise<ExtractedJobData | null> {
  try {
    const cleanText = cleanHtml(html).substring(0, 6000);

    const prompt = `Extract job posting data from this HTML. Return ONLY valid JSON (no markdown):
{
  "title": "job title (required)",
  "company": "company name (required)",
  "location": "location or remote",
  "employmentType": "Full-time|Part-time|Contract",
  "description": "job description (first 1000 chars)",
  "requirements": ["skill 1", "skill 2"],
  "benefits": ["benefit 1"],
  "salary": "salary range if available"
}

HTML/TEXT:
${cleanText}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      title: String(parsed.title || "").trim(),
      company: String(parsed.company || "").trim(),
      location: String(parsed.location || "").trim(),
      employmentType: String(parsed.employmentType || "Full-time").trim(),
      description: String(parsed.description || "").trim(),
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements.map((r: any) => String(r).trim()).filter((r: string) => r)
        : [],
      benefits: Array.isArray(parsed.benefits)
        ? parsed.benefits.map((b: any) => String(b).trim()).filter((b: string) => b)
        : [],
      salary: String(parsed.salary || "").trim(),
      confidence: 0.85,
      method: "llm",
    };
  } catch (error) {
    console.error("LLM extraction failed:", error);
    return null;
  }
}

/**
 * Extract requirements from text
 */
function extractRequirements(text: string): string[] {
  const reqs = new Set<string>();
  const lines = text.split(/[\n•\-*]/);

  for (const line of lines) {
    const cleaned = line.trim();
    if (cleaned.length > 10 && cleaned.length < 300) {
      reqs.add(cleaned);
    }
    if (reqs.size >= 15) break;
  }

  return Array.from(reqs).slice(0, 15);
}

/**
 * Extract benefits from text
 */
function extractBenefits(text: string): string[] {
  const benefits = new Set<string>();
  const patterns = [/health/i, /dental/i, /401k/i, /retirement/i, /pto/i, /vacation/i, /remote/i];

  for (const pattern of patterns) {
    const match = text.match(new RegExp(`[^.!?]*${pattern.source}[^.!?]*[.!?]`, "i"));
    if (match) benefits.add(match[0].trim());
  }

  return Array.from(benefits);
}

/**
 * Clean HTML to text
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Main extraction function with fallback chain
 */
export async function extractJobData(html: string): Promise<ExtractedJobData> {
  console.log("[EXTRACT] Starting extraction pipeline");

  // 1. Try JSON-LD (fastest)
  let result = extractJsonLd(html);
  if (result && result.title && result.company) {
    console.log("[EXTRACT] Success with JSON-LD");
    return result;
  }

  // 2. Try CSS selectors (fast)
  result = extractByCssSelectors(html);
  if (result && result.title && result.company && result.confidence > 0.7) {
    console.log("[EXTRACT] Success with CSS selectors");
    return result;
  }

  // 3. Try LLM (reliable)
  result = await extractWithLLM(html);
  if (result && result.title && result.company) {
    console.log("[EXTRACT] Success with LLM");
    return result;
  }

  // 4. Basic fallback
  console.warn("[EXTRACT] All methods failed, using basic extraction");
  return {
    title: "Job Position",
    company: "Company Name",
    location: "Location",
    employmentType: "Full-time",
    description: cleanHtml(html).substring(0, 2000),
    requirements: [],
    confidence: 0.3,
    method: "basic",
  };
}
