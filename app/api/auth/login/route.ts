import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyPassword } from "@/lib/auth"
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const client = await clientPromise
  const user = await client.db().collection("users").findOne({ email: String(email).trim().toLowerCase() })
  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const sessionUser = { email: user.email, name: user.name, role: user.role }
  const res = NextResponse.json({ user: sessionUser })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(sessionUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
  return res
}
