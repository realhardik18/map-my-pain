"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useUser } from "@clerk/nextjs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type BodyPartLog = {
  body_part: string
  intensity?: number | { $numberInt?: string } | null
  types?: string[]
  onset?: Record<string, any>
  pattern?: Record<string, any>
  triggers?: string[]
  relievers?: string[]
  associated_symptoms?: string[]
  medication?: Record<string, any>
  impact?: string
  prior_history?: string
  notes?: string
  red_flags?: string[]
}

type LogRow = {
  _id?: any
  patient_email?: string
  timestamp: string
  body_parts: BodyPartLog[]
  general_flag?: number | boolean | { $numberInt?: string }
  ai_summary?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function toNumberMaybe(val: unknown, fallback = 0): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const n = Number(val)
    return Number.isFinite(n) ? n : fallback
  }
  if (val && typeof val === "object" && "$numberInt" in (val as any)) {
    const raw = (val as any).$numberInt
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export default function HistoryPage() {
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const { data, isLoading } = useSWR<LogRow[]>(
    email ? `/api/log?patient_email=${encodeURIComponent(email)}` : null,
    fetcher,
  )

  const [filters, setFilters] = useState({
    body_part: "",
    intensity: "",
    trigger: "",
  })

  const onFilterChange = (name: "body_part" | "intensity" | "trigger", value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const logs = Array.isArray(data) ? data : []

  const filtered = useMemo(() => {
    const bodyPartQ = filters.body_part.trim().toLowerCase()
    const triggerQ = filters.trigger.trim().toLowerCase()
    const intensityQ = filters.intensity.trim()
    return logs.filter((log) => {
      const hasBodyPart = !bodyPartQ || log.body_parts?.some((bp) => bp.body_part?.toLowerCase().includes(bodyPartQ))

      const hasTrigger =
        !triggerQ || log.body_parts?.some((bp) => (bp.triggers || []).some((t) => t.toLowerCase().includes(triggerQ)))

      const hasIntensity =
        !intensityQ ||
        log.body_parts?.some((bp) => {
          const val = toNumberMaybe(bp.intensity, -1)
          const q = Number(intensityQ)
          return Number.isFinite(q) && val === q
        })

      return hasBodyPart && hasTrigger && hasIntensity
    })
  }, [logs, filters])

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-pretty text-2xl font-semibold tracking-tight">History</h1>
          <div aria-hidden />
        </header>

        {/* Filters */}
        
        {/* Table */}
        <section aria-label="Logs table" className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"
                aria-label="Loading"
                role="status"
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No history found matching your filters.</div>
          ) : (
            <Table>
              <TableCaption className="text-zinc-400">
                Showing {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
              </TableCaption>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-300">Date</TableHead>
                  <TableHead className="text-zinc-300">General Flag</TableHead>
                  <TableHead className="text-zinc-300">AI Summary</TableHead>
                  <TableHead className="text-zinc-300">Body Parts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log, i) => {
                  const dateStr = new Date(log.timestamp).toLocaleString()
                  const general = toNumberMaybe(log.general_flag, 0)
                  const generalLabel = general >= 1 ? "Flagged" : "Normal"

                  return (
                    <TableRow key={i} className="border-zinc-900/80">
                      <TableCell className="align-top text-zinc-200">{dateStr}</TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border",
                            general >= 1
                              ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                              : "border-zinc-700 bg-zinc-800 text-zinc-300",
                          )}
                        >
                          {generalLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-zinc-300">
                        <p className="max-w-xl text-pretty leading-relaxed">{log.ai_summary || "—"}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <ul className="flex max-w-xl flex-wrap gap-2">
                          {log.body_parts?.map((bp, idx) => {
                            const intensity = toNumberMaybe(bp.intensity, undefined as any)
                            return (
                              <li key={idx}>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border-zinc-700 bg-zinc-900 text-zinc-200",
                                    "hover:border-purple-500/60 hover:text-white",
                                  )}
                                  title={
                                    bp.triggers && bp.triggers.length
                                      ? `Triggers: ${bp.triggers.join(", ")}`
                                      : undefined
                                  }
                                >
                                  {bp.body_part}
                                  {Number.isFinite(intensity) ? ` • ${intensity}/10` : ""}
                                </Badge>
                              </li>
                            )
                          })}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  )
}
