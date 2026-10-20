"use client"

import Link from "next/link"
import useSWR from "swr"
import { useSession } from "@/lib/useSession"

type LogRow = { timestamp: string; general_flag?: number; pdf_data?: string; ai_summary?: string }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PatientHomePage() {
  const { user } = useSession()
  const { data } = useSWR<LogRow[]>("/api/log", fetcher)
  const logs = Array.isArray(data) ? data : []
  const flagged = logs.filter((l) => Number(l.general_flag) >= 1).length
  const reports = logs.filter((l) => l.pdf_data).length
  const last = logs.length ? new Date(logs[logs.length - 1].timestamp) : null
  const lastLabel = last && !isNaN(last.getTime()) ? last.toLocaleDateString() : "—"

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-pretty text-xl font-semibold text-white md:text-2xl">
          {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
        </h1>
        <div className="flex gap-2">
          <Link
            className="rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500"
            href="/patient/log"
          >
            New Log
          </Link>
          <Link
            className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            href="/patient/pain-map"
          >
            Open Pain Map
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Pain Logs" value={logs.length} />
        <Card title="Flagged Entries" value={flagged} />
        <Card title="Reports" value={reports} />
        <Card title="Last Logged" value={lastLabel} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-3 text-lg font-medium text-white">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/patient/log"
              className="rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500"
            >
              Add Pain Log
            </Link>
            <Link
              href="/patient/my-docs"
              className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              View Reports
            </Link>
            <Link
              href="/patient/history"
              className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              View History
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-3 text-lg font-medium text-white">Shortcuts</h2>
          <ul className="grid gap-2 text-sm">
            <li>
              <Link href="/patient/pain-map" className="text-violet-300 hover:text-violet-200">
                Pain Trends &amp; Charts
              </Link>
            </li>
            <li>
              <Link href="/patient/my-docs" className="text-violet-300 hover:text-violet-200">
                My Documents
              </Link>
            </li>
            <li>
              <Link href="/patient/history" className="text-violet-300 hover:text-violet-200">
                Recent Activity
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}

function Card({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
