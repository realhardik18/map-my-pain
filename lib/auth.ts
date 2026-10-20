import "server-only"
import { scryptSync, randomBytes, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "@/lib/session"

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, "hex")
  const actual = scryptSync(password, salt, 64)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

/**
 * Resolves the session for an API route. Returns either the user or a ready-made error response.
 */
export async function requireUser(role?: SessionUser["role"]) {
  const user = await getSessionUser()
  if (!user) return { user: null, error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) }
  if (role && user.role !== role) return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { user, error: null }
}

/**
 * Which patient's data the caller may read: admins can pick any patient (or all), patients only themselves.
 */
export function resolvePatientEmail(user: SessionUser, requested: string | null) {
  if (user.role === "admin") return requested
  return user.email
}
