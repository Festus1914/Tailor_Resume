import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Job } from "@/lib/models";
import { route, badRequest, tooManyRequests } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { z } from "zod";
import {
  validateUrl,
  normalizeUrl,
  extractDomain,
  extractJobData,
} from "@/lib/jobs/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit: 10 job submissions per user per minute
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000;

const jobSubmissionSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Please enter a valid URL")
    .max(2048),
  // Manual fallback fields if extraction fails
  title: z.string().trim().max(300).optional(),
  company: z.string().trim().max(300).optional(),
  location: z.string().trim().max(300).optional(),
  employmentType: z.string().trim().max(100).optional(),
  descriptionText: z.string().max(50000).optional(),
});

/**
 * Fetches a job posting URL with proper error handling.
 */
async function fetchJobUrl(
  url: string
): Promise<{
  html: string | null;
  status: number;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (response.status === 403 || response.status === 401) {
      return {
        html: null,
        status: response.status,
        error: "This website blocks automated access.",
      };
    }

    if (response.status === 404) {
      return {
        html: null,
        status: 404,
        error: "Job posting not found (404).",
      };
    }

    if (response.status === 429) {
      return {
        html: null,
        status: 429,
        error: "The website is rate limiting requests. Try again later.",
      };
    }

    if (!response.ok) {
      return {
        html: null,
        status: response.status,
        error: `HTTP ${response.status}: Unable to fetch the page.`,
      };
    }

    const html = await response.text();
    return { html, status: 200 };
  } catch (err) {
    const error = err as Error;
    if (error.name === "AbortError") {
      return {
        html: null,
        status: 0,
        error: "Request timed out. The website took too long to respond.",
      };
    }
    return {
      html: null,
      status: 0,
      error: "Could not fetch the URL. Check that it's valid and public.",
    };
  }
}

export const GET = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  // Get query parameters
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);

  const filter =
    status === "all"
      ? { userId: user._id }
      : { userId: user._id, fetchStatus: status };

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  return NextResponse.json({
    jobs,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const POST = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  // Rate limiting
  const recentCount = await Job.countDocuments({
    userId: user._id,
    createdAt: { $gte: new Date(Date.now() - RATE_WINDOW_MS) },
  });

  if (recentCount >= RATE_LIMIT) {
    throw tooManyRequests(
      `You can submit ${RATE_LIMIT} jobs per minute. Try again shortly.`
    );
  }

  const body = await req.json().catch(() => ({}));
  const { url, title, company, location, employmentType, descriptionText } =
    jobSubmissionSchema.parse(body);

  // Validate URL format and safety
  const validation = validateUrl(url);
  if (!validation.valid) {
    throw badRequest(validation.error || "Invalid URL");
  }

  // Check if already submitted
  const normalized = normalizeUrl(url);
  const existing = await Job.findOne({
    userId: user._id,
    normalizedUrl: normalized,
  });

  if (existing) {
    throw badRequest("You've already submitted this job posting.");
  }

  // Fetch the job page
  const { html, status: fetchStatus, error: fetchError } = await fetchJobUrl(
    url
  );

  // If fetch failed, create job record with error
  if (!html) {
    const job = await Job.create({
      userId: user._id,
      url,
      normalizedUrl: normalized,
      domain: extractDomain(url),
      fetchStatus: "failed",
      httpStatus: fetchStatus || null,
      error: fetchError || "Unknown error",
      source: "manual",
      extractionConfidence: 0,
    });

    return NextResponse.json(
      {
        job,
        warning: fetchError,
      },
      { status: 400 }
    );
  }

  // Extract job data from HTML with LLM fallback for accuracy
  const extracted = await extractJobData(url, html, {
    title,
    company,
    location,
    employmentType,
    descriptionText,
  }).catch((error) => {
    console.error("Job extraction error:", error);
    // Return safe fallback on extraction error
    return {
      title: title || "",
      company: company || "",
      location: location || "",
      employmentType: employmentType || "",
      descriptionText: descriptionText || "",
      requirements: [],
      source: "manual" as const,
      extractionConfidence: 0.3,
    };
  });

  // Create the job record
  const job = await Job.create({
    userId: user._id,
    url,
    normalizedUrl: normalized,
    domain: extractDomain(url),
    title: extracted.title,
    company: extracted.company,
    location: extracted.location,
    employmentType: extracted.employmentType,
    descriptionText: extracted.descriptionText,
    requirements: extracted.requirements,
    source: extracted.source,
    extractionConfidence: extracted.extractionConfidence,
    fetchStatus: "ok",
    httpStatus: 200,
    error: "",
  });

  return NextResponse.json(
    {
      job,
      extractedFields: {
        title: extracted.title,
        company: extracted.company,
        confidence: extracted.extractionConfidence,
      },
    },
    { status: 201 }
  );
});
