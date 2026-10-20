// Signed-cookie sessions. Uses Web Crypto so it runs in both middleware (edge) and route handlers (node).

export type Role = "patient" | "admin"

export type SessionUser = {
  email: string
  name: string
  role: Role
}

type SessionPayload = SessionUser & { exp: number }

export const SESSION_COOKIE = "mmp_session"
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

const encoder = new TextEncoder()

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return secret
}

function base64url(bytes: Uint8Array) {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))))
}

export async function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  return `${body}.${await hmac(body)}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  if ((await hmac(body)) !== sig) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return { email: payload.email, name: payload.name, role: payload.role }
  } catch {
    return null
  }
}
