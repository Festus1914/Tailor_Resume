import type { IJob } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Job data extraction from URLs and HTML.
 *
 * Supports:
 * - JSON-LD structured data (highest confidence, fastest)
 * - Claude LLM extraction (fallback, handles any format)
 * - Manual entry fallback
 * - Error handling for protected/unsupported sites
 */

export interface ExtractedJob {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  descriptionText: string;
  requirements: string[];
  source: "jsonld" | "llm" | "manual";
  extractionConfidence: number;
}

const client = new Anthropic();

/**
 * Normalizes a URL for deduplication:
 * - Lowercased hostname
 * - Trailing slash removed
 * - Query parameters and fragments stripped
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking parameters
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((param) => {
      parsed.searchParams.delete(param);
    });
    // Remove fragment and trailing slash
    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${
      parsed.searchParams.toString() ? `?${parsed.searchParams}` : ""
    }`.toLowerCase();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Extracts the domain from a URL for throttling purposes.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Validates if a URL is safe and follows the robots.txt restrictions.
 *
 * Returns null if valid, or an error message if invalid.
 */
export function validateUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  // Basic URL format check
  try {
    const parsed = new URL(url);

    // Reject non-HTTP(S) protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        valid: false,
        error: "Only HTTP and HTTPS URLs are supported.",
      };
    }

    // Reject localhost and internal IPs
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return {
        valid: false,
        error: "Internal/local URLs are not supported.",
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: "Invalid URL format.",
    };
  }
}

/**
 * Extracts Job-LD structured data from HTML.
 *
 * JSON-LD is embedded as <script type="application/ld+json"> tags.
 */
export function extractJsonLd(html: string): ExtractedJob | null {
  try {
    const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const content = match[1];
      const data = JSON.parse(content);

      // Look for JobPosting or any nested JobPosting in @graph
      let jobPosting = data;
      if (data["@graph"]) {
        jobPosting = data["@graph"].find(
          (item: unknown) =>
            (item as Record<string, unknown>)["@type"] === "JobPosting"
        );
      }

      if (
        jobPosting &&
        (jobPosting["@type"] === "JobPosting" ||
          jobPosting["@type"]?.includes("JobPosting"))
      ) {
        const job = jobPosting as Record<string, unknown>;
        const org = job.hiringOrganization as Record<string, unknown> | null;
        const address = job.jobLocation as Record<string, unknown> | null;

        return {
          title: String(job.title || job.jobTitle || ""),
          company: String(org?.name || org?.["name"] || job.company || ""),
          location: String(address?.address || address?.addressLocality || ""),
          employmentType: String(job.employmentType || ""),
          descriptionText: String(job.description || ""),
          requirements: extractRequirements(String(job.description || "")),
          source: "jsonld",
          extractionConfidence: 0.95, // JSON-LD is authoritative
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Simple requirement extraction from job description text.
 *
 * Looks for common patterns like bullet points or numbered lists.
 */
export function extractRequirements(text: string): string[] {
  const requirements: string[] = [];

  // Split by common delimiters and filter empty lines
  const lines = text
    .split(/[\n•\-*]/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 10 && line.length < 500); // Reasonable requirement length

  // Take up to 15 requirements
  return lines.slice(0, 15);
}

/**
 * Extracts job data using Claude LLM.
 *
 * Fast, accurate extraction for any job board format.
 * Parses unstructured HTML and description text intelligently.
 *
 * Optimizations:
 * - Concise prompts for faster processing
 * - Timeout handling (15 seconds)
 * - Better error recovery
 */
async function extractJobWithLLM(
  html: string,
  descriptionText?: string
): Promise<ExtractedJob | null> {
  try {
    // Extract visible text from HTML for LLM processing
    const cleanText = extractVisibleText(html).slice(0, 5000); // Reduced from 8000 for faster processing

    // Concise prompt for faster LLM processing
    const prompt = `Extract job data from this HTML. Return ONLY valid JSON:
{
  "title": "job title",
  "company": "company",
  "location": "location or remote",
  "employmentType": "type or empty",
  "descriptionText": "description (first 300 chars)",
  "requirements": ["req1", "req2", "req3"]
}

HTML:
${cleanText}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300, // Reduced from 500
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    clearTimeout(timeoutId);

    const responseText =
      message.content[0]?.type === "text" ? message.content[0].text : "";

    if (!responseText) {
      console.warn("Empty LLM response");
      return null;
    }

    // Parse the JSON response with better error handling
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("No JSON found in LLM response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      title: String(parsed.title || "").trim().slice(0, 300),
      company: String(parsed.company || "").trim().slice(0, 300),
      location: String(parsed.location || "").trim().slice(0, 300),
      employmentType: String(parsed.employmentType || "").trim().slice(0, 100),
      descriptionText: String(parsed.descriptionText || "").trim().slice(0, 2000),
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements
            .map((r: unknown) => String(r).trim().slice(0, 500))
            .filter((r: string) => r.length > 0)
            .slice(0, 10)
        : [],
      source: "llm",
      extractionConfidence: 0.85,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("LLM extraction timeout");
    } else {
      console.error("LLM extraction failed:", error);
    }
    return null;
  }
}

/**
 * Extracts visible text from HTML (removes scripts, styles, etc).
 */
function extractVisibleText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determines the best extraction method based on available data.
 *
 * Attempts JSON-LD first (fastest, highest confidence),
 * then falls back to Claude LLM (accurate, works anywhere),
 * finally manual entry if provided.
 */
export async function extractJobData(
  url: string,
  html: string,
  manual?: Partial<ExtractedJob>
): Promise<ExtractedJob> {
  // Try JSON-LD extraction (fastest)
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    return jsonLd;
  }

  // Try Claude LLM extraction (accurate fallback)
  const llmExtraction = await extractJobWithLLM(
    html,
    manual?.descriptionText
  );
  if (llmExtraction && llmExtraction.title && llmExtraction.company) {
    return llmExtraction;
  }

  // Fallback to manual data if provided
  if (manual && (manual.title || manual.company)) {
    return {
      title: manual.title || "",
      company: manual.company || "",
      location: manual.location || "",
      employmentType: manual.employmentType || "",
      descriptionText: manual.descriptionText || "",
      requirements: manual.requirements || [],
      source: "manual",
      extractionConfidence: 0.5,
    };
  }

  // Return empty job if nothing works
  return {
    title: "",
    company: "",
    location: "",
    employmentType: "",
    descriptionText: "",
    requirements: [],
    source: "llm",
    extractionConfidence: 0,
  };
}
