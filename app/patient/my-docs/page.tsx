"use client"

import { useState } from "react"
import useSWR from "swr"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

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
  pdf_data?: string
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

function isLikelyMarkdown(s?: string) {
  if (!s) return false
  return /(^|\n)\s*#|(^|\n)\s*[-*]\s+|(^|\n)\s*\|.+\|/m.test(s)
}

function getReportMarkdown(log?: LogRow) {
  if (!log) return ""
  const primary = (log as any).pdf_data as string | undefined
  const fallback = log.ai_summary || ""
  if (primary && isLikelyMarkdown(primary)) return primary
  return fallback
}

export default function HistoryPage() {
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const { data, isLoading } = useSWR<LogRow[]>(
    email ? `/api/log?patient_email=${encodeURIComponent(email)}` : null,
    fetcher,
  )

  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null)

  const logs = Array.isArray(data) ? data : []
  const displayed = logs

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-pretty text-2xl font-semibold tracking-tight">History</h1>
          <div aria-hidden />
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Table */}
          <section
            aria-label="Logs table"
            className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 lg:col-span-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"
                  aria-label="Loading"
                  role="status"
                />
              </div>
            ) : displayed.length === 0 ? (
              <div className="p-8 text-center text-zinc-400">No history found.</div>
            ) : (
              <Table>
                <TableCaption className="text-zinc-400">
                  Showing {displayed.length} entr{displayed.length === 1 ? "y" : "ies"}
                </TableCaption>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-300">Date</TableHead>
                    <TableHead className="text-zinc-300">General Flag</TableHead>
                    <TableHead className="text-zinc-300">AI Summary</TableHead>
                    <TableHead className="text-zinc-300">Body Parts</TableHead>
                    {/* New Actions column */}
                    <TableHead className="text-right text-zinc-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map((log, i) => {
                    const dateStr = new Date(log.timestamp).toLocaleString()
                    const general = toNumberMaybe(log.general_flag, 0)
                    const generalLabel = general >= 1 ? "Flagged" : "Normal"
                    const isSelected = selectedLog?._id === log._id

                    return (
                      <TableRow
                        key={i}
                        className={cn(
                          "border-zinc-900/80 transition-colors",
                          isSelected ? "bg-purple-500/5" : "hover:bg-zinc-900/40",
                        )}
                      >
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
                          <p className="max-w-xl text-pretty leading-relaxed line-clamp-3">{log.ai_summary || "—"}</p>
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
                        <TableCell className="align-top text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedLog(log)}
                            aria-controls="report-panel"
                            className={cn(
                              "border border-zinc-700 bg-zinc-900 text-zinc-200",
                              "hover:border-purple-500 hover:text-white hover:bg-zinc-900/80",
                              isSelected && "border-purple-500/60 text-white",
                            )}
                          >
                            View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </section>

          <aside
            id="report-panel"
            aria-label="Report"
            className="sticky top-4 h-fit rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
          >
            <h2 className="mb-3 text-lg font-medium text-zinc-200">Report</h2>
            {!selectedLog ? (
              <p className="text-sm text-zinc-400">Select “View Report” on a row to see its details here.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-zinc-400">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                <div className="prose prose-invert prose-zinc max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{getReportMarkdown(selectedLog)}</ReactMarkdown>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
