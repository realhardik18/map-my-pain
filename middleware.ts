import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

// Page-level gate. API routes do their own checks (see lib/auth.ts) so they can return JSON errors.
export async function middleware(req: NextRequest) {
  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  const { pathname } = req.nextUrl

  if (!user) {
    const url = new URL("/sign-in", req.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/patient", req.url))
  }
  if (pathname.startsWith("/patient") && user.role !== "patient") {
    return NextResponse.redirect(new URL("/admin", req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/patient/:path*", "/admin/:path*"],
}
