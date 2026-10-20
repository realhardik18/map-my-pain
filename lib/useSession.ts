"use client"

import useSWR from "swr"
import type { SessionUser } from "@/lib/session"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useSession() {
  const { data, isLoading, mutate } = useSWR<{ user: SessionUser | null }>("/api/auth/me", fetcher)
  return { user: data?.user ?? null, isLoaded: !isLoading, mutate }
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" })
  window.location.href = "/sign-in"
}
