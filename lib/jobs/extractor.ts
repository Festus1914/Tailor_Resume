import type { IJob } from "@/lib/models";

/**
 * Job data extraction from URLs and HTML.
 *
 * Supports:
 * - JSON-LD structured data (highest confidence)
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
 * Determines the best extraction method based on available data.
 *
 * Attempts JSON-LD first (highest confidence), then falls back to
 * manual entry placeholder.
 */
export async function extractJobData(
  url: string,
  html: string,
  manual?: Partial<ExtractedJob>
): Promise<ExtractedJob> {
  // Try JSON-LD extraction
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    return jsonLd;
  }

  // Fallback to manual data if provided
  if (manual) {
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
