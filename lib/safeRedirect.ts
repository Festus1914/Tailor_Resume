/**
 * Validates a post-login redirect target.
 *
 * `?next=` comes from the URL, so it is attacker-controllable. Echoing it into a
 * redirect unchecked is an open redirect: a link to
 * `/login?next=https://evil.example` would bounce a freshly authenticated user
 * onto a look-alike site, which is exactly the setup for credential phishing.
 *
 * Only same-origin absolute paths are allowed. Rejected in particular:
 *   - `https://evil.example`  — absolute URL to another origin
 *   - `//evil.example`        — protocol-relative, still another origin
 *   - `/\evil.example`        — backslash, which some browsers normalize to `/`
 *   - `javascript:...`        — no scheme is permitted at all
 */
export function safeRedirectPath(
  value: string | string[] | undefined,
  fallback = "/"
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;
  return candidate;
}
