import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic page guard: app pages need the `session_hint` cookie the backend sets on login
 * (the refresh cookie is scoped to /api/auth, so pages can't see it). The backend still checks
 * every API call; an expired session is refreshed or sent to /login by lib/api.ts.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("access_token") || request.cookies.get("session_hint")?.value === "1") {
    return NextResponse.next();
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/chat/:path*", "/documents/:path*", "/image/:path*", "/learn/:path*", "/settings/:path*", "/test/:path*"],
};
