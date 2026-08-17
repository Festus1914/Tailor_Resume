import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse routing for signed-in vs signed-out visitors.
 *
 * IMPORTANT — this is NOT the authorization boundary.
 *
 * Middleware runs on the Edge runtime, which has no TCP sockets and therefore no
 * Mongoose. It cannot validate a session token, look up a role, or check whether
 * an account is still approved; all it can see is whether a cookie is *present*.
 * A forged or expired cookie sails straight through.
 *
 * Its only job is to save signed-out visitors a wasted render and send them to
 * the login page. Real enforcement happens where the database is reachable:
 * `requireUser()` / `requireAdmin()` in every protected route handler and
 * layout. Adding a route here without also guarding it there leaves it open.
 */

const SESSION_COOKIES = ["__Host-rt_session", "rt_session"];

/** Reachable without a session. */
const PUBLIC_PATHS = ["/login", "/signup", "/pending"];

/** Auth endpoints must stay open — you cannot log in if login requires a login. */
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => !!req.cookies.get(name)?.value);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = hasSessionCookie(req);

  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublicApi) return NextResponse.next();

  if (isPublicPage) {
    // Someone with a session has no reason to see the login form.
    if (signedIn && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    // API routes get a status code, not a redirect: a fetch() following a 307 to
    // an HTML login page produces a confusing JSON parse error at the call site.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "You must sign in to do that.", code: "unauthorized" },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", req.url);
    // Preserved so the user lands where they were headed after signing in. The
    // login page validates this is a local path before using it, so it cannot
    // become an open redirect.
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next's internals and static files. Note this deliberately
   * still covers /api/* — those are handled above — so a new API route is gated
   * by default rather than by remembering to add it.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
