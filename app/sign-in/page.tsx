"use client"

import { Suspense, useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"

const DitheringClient = dynamic(() => import("@paper-design/shaders-react").then((m) => m.Dithering), { ssr: false })

const DEMO_ACCOUNTS = [
  { label: "Patient", email: "priya@demo.local", password: "patient123" },
  { label: "Admin / Clinician", email: "admin@demo.local", password: "admin123" },
]

function SignInForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || "Sign in failed")
        return
      }
      const home = json.user.role === "admin" ? "/admin" : "/patient"
      const next = searchParams.get("next")
      window.location.href = next && next.startsWith(home) ? next : home
    } catch {
      setError("Could not reach the server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[hsl(274,71%,58%)]"
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[hsl(274,71%,58%)]"
          required
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[hsl(274,71%,58%)] px-4 py-2 font-medium text-white hover:bg-[hsl(274,71%,50%)] focus-visible:ring-2 focus-visible:ring-[hsl(274,71%,58%)] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500">
        <p className="mb-2 font-medium text-zinc-600">Demo accounts</p>
        <ul className="space-y-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-2">
              <span>
                {a.label}: <code>{a.email}</code> / <code>{a.password}</code>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword(a.password)
                }}
                className="text-[hsl(274,71%,58%)] hover:text-[hsl(274,71%,50%)]"
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  )
}

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-white text-zinc-900">
      {/* Container */}
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        {/* Left: 3/4 - Centered Sign In */}
        <section className="flex w-full flex-1 items-center justify-center p-6 md:basis-3/4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white/70 p-6 shadow-lg shadow-zinc-300/30 backdrop-blur">
            {/* Optional heading for clarity (kept minimal) */}
            <h1 className="mb-6 text-center text-pretty text-2xl font-semibold tracking-tight">Welcome back</h1>

            <Suspense>
              <SignInForm />
            </Suspense>
          </div>
        </section>

        {/* Right: 1/4 - Shader panel (hidden on small screens) */}
        <aside className="hidden h-screen w-100 items-stretch justify-stretch border-t border-zinc-200 md:flex md:basis-1/4 md:border-t-0 md:border-l">
          <div className="relative h-full w-full">
            {/* Ensure the shader fills this panel */}
            <div className="absolute inset-0">
              <DitheringClient
                style={{ height: "100%", width: "100%" }}
                colorBack="hsla(0, 0%, 100%, 0)" // transparent white
                colorFront="hsl(274, 71%, 58%)"
                shape="swirl"
                type="8x8"
                pxSize={2}
                offsetX={0}
                offsetY={0}
                scale={1}
                rotation={0}
                speed={1}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
  