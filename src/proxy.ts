import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/sign-in", "/sign-up"];

/**
 * Optimistic check: redirects requests without a session cookie to sign in.
 * The real session check happens in the app layout and in every server action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.includes(pathname) || getSessionCookie(request)) return NextResponse.next();

  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  // Everything except the auth API, Next internals and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
