/**
 * Batch job extraction processor for handling multiple URLs efficiently.
 * Features:
 * - Parallel processing with concurrency control
 * - Request deduplication
 * - Error recovery
 */

interface BatchJobRequest {
  url: string;
  priority?: number;
}

interface BatchJobResult {
  url: string;
  status: "success" | "failed" | "pending";
  title?: string;
  company?: string;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Processes multiple job URLs concurrently with rate limiting.
 * Returns results as they complete.
 */
export async function processBatchJobs(
  urls: BatchJobRequest[],
  onProgressUpdate?: (result: BatchJobResult) => void,
  concurrencyLimit: number = 3
): Promise<BatchJobResult[]> {
  const results: BatchJobResult[] = [];
  const queue = [...urls].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const inProgress = new Set<string>();

  return new Promise((resolve) => {
    const processNext = async () => {
      if (queue.length === 0 && inProgress.size === 0) {
        resolve(results);
        return;
      }

      while (inProgress.size < concurrencyLimit && queue.length > 0) {
        const request = queue.shift();
        if (!request) break;

        inProgress.add(request.url);
        processJobUrl(request.url).then((result) => {
          results.push(result);
          onProgressUpdate?.(result);
          inProgress.delete(request.url);
          processNext();
        });
      }
    };

    processNext();
  });
}

/**
 * Processes a single job URL and returns extraction result.
 */
async function processJobUrl(url: string): Promise<BatchJobResult> {
  const startTime = Date.now();

  try {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (res.ok && data.job) {
      return {
        url,
        status: "success",
        title: data.job.title,
        company: data.job.company,
        processingTimeMs: Date.now() - startTime,
      };
    } else {
      return {
        url,
        status: "failed",
        error: data.error || data.warning || "Unknown error",
        processingTimeMs: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      url,
      status: "failed",
      error: error instanceof Error ? error.message : "Network error",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extracts multiple URLs from text (comma/newline separated).
 */
export function extractUrlsFromText(text: string): string[] {
  const urlRegex =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]; // Deduplicate
}

/**
 * Generates a cache key for a normalized URL.
 */
export function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return Buffer.from(normalized).toString("base64");
  } catch {
    return Buffer.from(url.toLowerCase()).toString("base64");
  }
}
