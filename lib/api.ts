import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Shared error handling for route handlers.
 *
 * The rule this enforces: errors the client is allowed to act on are declared
 * explicitly as ApiError; everything else becomes a generic 500 with the detail
 * logged server-side only. The pre-database version returned `err.message`
 * straight to the client, which leaks connection strings, file paths, and
 * driver internals whenever something unexpected fails.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages, for form rendering. */
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new ApiError(400, "bad_request", message, fields);

export const unauthorized = (message = "You must sign in to do that.") =>
  new ApiError(401, "unauthorized", message);

export const forbidden = (message = "You do not have access to that.") =>
  new ApiError(403, "forbidden", message);

export const notFound = (message = "Not found.") =>
  new ApiError(404, "not_found", message);

export const conflict = (message: string) =>
  new ApiError(409, "conflict", message);

export const tooManyRequests = (message: string) =>
  new ApiError(429, "too_many_requests", message);

/** Converts a thrown value into a safe response. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code, fields: err.fields },
      { status: err.status }
    );
  }

  if (err instanceof ZodError) {
    // Flatten to field -> first message, which is what the forms render.
    const fields: Record<string, string> = {};
    for (const issue of err.errors) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      { error: "Please check the highlighted fields.", code: "validation", fields },
      { status: 400 }
    );
  }

  // Unexpected: log with detail, respond without it.
  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", code: "internal" },
    { status: 500 }
  );
}

/**
 * Wraps a route handler so thrown ApiErrors and ZodErrors become responses.
 * Keeps handlers linear — they can assert preconditions by throwing rather than
 * threading early returns through every branch.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Client IP, honoring the proxy headers Vercel and most hosts set. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "";
}

export function userAgent(req: Request): string {
  return (req.headers.get("user-agent") ?? "").slice(0, 500);
}
