"use client"

import { useState, useEffect, useMemo } from "react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts"
import { format } from "date-fns"

interface BodyPart {
  body_part: string
  intensity: number
  notes: string
}

interface Medication {
  taking: boolean
  name: string
  dose: string | number
  effectiveness: string
}

interface Log {
  _id: string
  patient_email: string
  timestamp: string
  body_parts: BodyPart[]
  general_flag: number
  ai_summary: string
  pdf_data: string
  medication: Medication
}

export default function PainMapPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedLogs, setSelectedLogs] = useState<Log[]>([])
  const [graphType, setGraphType] = useState<"line" | "bar" | "scatter" | "xy">("line")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const idToLog = useMemo(() => {
    const m = new Map<string, Log>()
    for (const l of selectedLogs) m.set(l._id, l)
    return m
  }, [selectedLogs])

  const maxDoseMg = useMemo(() => {
    let max = 0
    for (const log of selectedLogs) {
      const taking = !!log.medication?.taking
      if (!taking) continue
      const doseVal =
        typeof log.medication?.dose === "string"
          ? Number.parseFloat(log.medication.dose) || 0
          : Number(log.medication?.dose || 0)
      if (doseVal > max) max = doseVal
    }
    return max
  }, [selectedLogs])

  const chartData = useMemo(() => {
    return selectedLogs.map((log) => {
      const bodyPart = log.body_parts?.[0] // Taking first body part for simplicity
      const intensity = bodyPart ? bodyPart.intensity : 0
      const doseMg = log.medication?.taking
        ? typeof log.medication?.dose === "string"
          ? Number.parseFloat(log.medication.dose) || 0
          : Number(log.medication?.dose || 0)
        : 0
      const normalizedDose = maxDoseMg > 0 ? Number(((doseMg / maxDoseMg) * 10).toFixed(1)) : 0

      return {
        date: format(new Date((log as any).parsed_date), "MMM dd, yyyy"),
        intensity,
        doseMg,
        normalizedDose,
        bodyPart: bodyPart ? bodyPart.body_part : "unknown",
        medication: log.medication?.taking ? log.medication.name : "None",
        effectiveness: log.medication?.taking ? log.medication.effectiveness : "N/A",
        notes: bodyPart ? bodyPart.notes : "",
        id: log._id,
      }
    })
  }, [selectedLogs, maxDoseMg])

  const { rangeLabel, fromDateISO, toDateISO } = useMemo(() => {
    if (!selectedLogs.length) return { rangeLabel: "No range", fromDateISO: "", toDateISO: "" }
    const sorted = [...selectedLogs].sort((a: any, b: any) => (a.parsed_date as any) - (b.parsed_date as any))
    const from = new Date((sorted[0] as any).parsed_date)
    const to = new Date((sorted[sorted.length - 1] as any).parsed_date)
    return {
      rangeLabel: `${format(from, "MMM dd, yyyy")} — ${format(to, "MMM dd, yyyy")}`,
      fromDateISO: format(from, "yyyy-MM-dd"),
      toDateISO: format(to, "yyyy-MM-dd"),
    }
  }, [selectedLogs])

  function handleExportCSV() {
    const headers = [
      "id",
      "date",
      "bodyPart",
      "intensity",
      "medication",
      "doseMg",
      "normalizedDose_0to10",
      "effectiveness",
      "notes",
    ]
    const rows = chartData.map((d) => [
      d.id,
      d.date,
      d.bodyPart,
      d.intensity,
      d.medication,
      d.doseMg,
      d.normalizedDose,
      d.effectiveness,
      (d.notes || "").replace(/\n/g, " ").replace(/"/g, '""'),
    ])
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          r
            .map((cell) => {
              const val = String(cell ?? "")
              return /[",\n]/.test(val) ? `"${val}"` : val
            })
            .join(","),
        )
        .join("\n")

    const filename = `pain-logs_${fromDateISO || "start"}_to_${toDateISO || "end"}.csv`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const userEmail = "hrdk.biz@gmail.com" // Replace with actual user email retrieval
        const response = await fetch(`/api/log?patient_email=${userEmail}`)
        if (!response.ok) throw new Error("Failed to fetch logs")

        const data = await response.json()

        const processedData = data.map((log: Log) => {
          try {
            let standardTimestamp
            if (log.timestamp.includes("at")) {
              const dateParts = log.timestamp.split(" at ")
              const date = new Date(dateParts[0])
              standardTimestamp = date.toISOString()
            } else {
              standardTimestamp = new Date(log.timestamp).toISOString()
            }

            return {
              ...log,
              timestamp: standardTimestamp,
              parsed_date: new Date(standardTimestamp),
            }
          } catch (error) {
            console.error(`Error parsing timestamp: ${log.timestamp}`, error)
            return {
              ...log,
              parsed_date: new Date(0),
            }
          }
        })

        processedData.sort((a: any, b: any) => a.parsed_date - b.parsed_date)

        setLogs(processedData)

        const uniqueYears = Array.from(
          new Set(
            processedData
              .filter((log: any) => !isNaN(log.parsed_date.getFullYear()))
              .map((log: any) => log.parsed_date.getFullYear()),
          ),
        ).sort()

        setYears(uniqueYears as number[])

        if (uniqueYears.length > 0) {
          setSelectedYear(uniqueYears[uniqueYears.length - 1] as number)
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching logs:", error)
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  useEffect(() => {
    if (selectedYear) {
      const filtered = logs.filter((log: any) => {
        const logYear = new Date(log.parsed_date).getFullYear()
        return logYear === selectedYear
      })
      setSelectedLogs(filtered)
    } else {
      setSelectedLogs([])
    }
  }, [selectedYear, logs])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-black text-white">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-ping rounded-full bg-purple-500" />
          <span className="text-sm text-zinc-300">Loading pain logs…</span>
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl bg-black p-4 text-white md:p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-pretty text-2xl font-semibold tracking-tight md:text-3xl">Pain Tracking Analysis</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-400">
            {selectedYear ? `Year: ${selectedYear}` : "Choose a year"} • Range: {rangeLabel}
          </p>
          {chartData.length > 0 ? (
            <button
              onClick={handleExportCSV}
              className="rounded-md border border-purple-700/40 bg-purple-600/20 px-3 py-1.5 text-sm text-purple-200 transition-colors hover:bg-purple-600/30"
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </header>

      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Select Year</h2>
          <div className="flex flex-wrap gap-2">
            {years.map((year) => (
              <button
                key={year}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  selectedYear === year ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Graph Type</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "line", label: "Line (Time Series)" },
              { key: "bar", label: "Bar" },
              { key: "scatter", label: "Scatter" },
              { key: "xy", label: "X vs Y (Dose vs Intensity)" },
            ].map((g) => (
              <button
                key={g.key}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  graphType === (g.key as any)
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
                onClick={() => setGraphType(g.key as any)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">
              {graphType === "xy"
                ? "Medication Dose (mg) vs Pain Intensity"
                : "Pain Intensity vs Medication Dose (normalized 0–10)"}{" "}
              <span className="text-zinc-500">({selectedYear || "No Year Selected"})</span>
            </h2>

            {chartData.length > 0 ? (
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {graphType === "line" ? (
                    <LineChart
                      data={chartData}
                      onMouseLeave={() => setHoveredId(null)}
                      onMouseMove={(state: any) => {
                        const idx = state?.activeTooltipIndex
                        if (idx != null && chartData[idx]) setHoveredId(chartData[idx].id)
                      }}
                      onClick={(state: any) => {
                        const idx = state?.activeTooltipIndex
                        if (idx != null && chartData[idx]) setSelectedId(chartData[idx].id)
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" stroke="#a1a1aa" />
                      <YAxis
                        domain={[0, 10]}
                        stroke="#a1a1aa"
                        label={{
                          value: "Scale (0–10)",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#a1a1aa",
                        }}
                      />
                      <Tooltip
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", color: "#fff" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "Dose (normalized)") {
                            const mg = props?.payload?.doseMg
                            return [`${value} (raw ${mg} mg)`, "Dose (normalized)"]
                          }
                          return [value, name]
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="intensity" stroke="#a78bfa" name="Pain Intensity" />
                      <Line type="monotone" dataKey="normalizedDose" stroke="#34d399" name="Dose (normalized)" />
                    </LineChart>
                  ) : graphType === "bar" ? (
                    <BarChart
                      data={chartData}
                      onMouseLeave={() => setHoveredId(null)}
                      onMouseMove={(state: any) => {
                        const idx = state?.activeTooltipIndex
                        if (idx != null && chartData[idx]) setHoveredId(chartData[idx].id)
                      }}
                      onClick={(state: any) => {
                        const idx = state?.activeTooltipIndex
                        if (idx != null && chartData[idx]) setSelectedId(chartData[idx].id)
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" stroke="#a1a1aa" />
                      <YAxis domain={[0, 10]} stroke="#a1a1aa" />
                      <Tooltip
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", color: "#fff" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "Dose (normalized)") {
                            const mg = props?.payload?.doseMg
                            return [`${value} (raw ${mg} mg)`, "Dose (normalized)"]
                          }
                          return [value, name]
                        }}
                      />
                      <Legend />
                      <Bar dataKey="intensity" fill="#a78bfa" name="Pain Intensity" />
                      <Bar dataKey="normalizedDose" fill="#34d399" name="Dose (normalized)" />
                    </BarChart>
                  ) : graphType === "scatter" ? (
                    <ScatterChart
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={(e: any) => {
                        const id = e?.activePayload?.[0]?.payload?.id
                        if (id) setSelectedId(id)
                      }}
                    >
                      <CartesianGrid stroke="#27272a" />
                      <XAxis type="number" dataKey="doseMg" name="Medication Dose (mg)" stroke="#a1a1aa" />
                      <YAxis type="number" dataKey="intensity" name="Pain Intensity" stroke="#a1a1aa" />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", color: "#fff" }}
                        labelStyle={{ color: "#a1a1aa" }}
                      />
                      <Legend />
                      <Scatter
                        name="Pain vs Medication"
                        data={chartData}
                        fill="#a78bfa"
                        onMouseEnter={(o: any) => {
                          const id = o?.payload?.id
                          if (id) setHoveredId(id)
                        }}
                        onClick={(o: any) => {
                          const id = o?.payload?.id
                          if (id) setSelectedId(id)
                        }}
                      />
                    </ScatterChart>
                  ) : (
                    <ScatterChart
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={(e: any) => {
                        const id = e?.activePayload?.[0]?.payload?.id
                        if (id) setSelectedId(id)
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        type="number"
                        dataKey="doseMg"
                        name="Medication Dose (mg)"
                        label={{ value: "Medication Dose (mg)", position: "insideBottom", offset: -5, fill: "#a1a1aa" }}
                        stroke="#a1a1aa"
                      />
                      <YAxis
                        type="number"
                        dataKey="intensity"
                        name="Pain Intensity"
                        label={{ value: "Pain Intensity", angle: -90, position: "insideLeft", fill: "#a1a1aa" }}
                        stroke="#a1a1aa"
                      />
                      <Tooltip
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", color: "#fff" }}
                        labelFormatter={() => ""}
                      />
                      <Legend />
                      <Scatter
                        name="Dose vs Intensity Correlation"
                        data={chartData}
                        fill="#a78bfa"
                        shape="circle"
                        onMouseEnter={(o: any) => {
                          const id = o?.payload?.id
                          if (id) setHoveredId(id)
                        }}
                        onClick={(o: any) => {
                          const id = o?.payload?.id
                          if (id) setSelectedId(id)
                        }}
                      />
                    </ScatterChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-md border border-zinc-800 p-4 text-center text-zinc-400">
                No data available for the selected year
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 p-3">
              <h2 className="text-sm font-medium text-zinc-300">Pain Log Details</h2>
            </div>
            {chartData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900 text-zinc-300">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Body Part</th>
                      <th className="px-4 py-2 text-left font-medium">Intensity</th>
                      <th className="px-4 py-2 text-left font-medium">Medication</th>
                      <th className="px-4 py-2 text-left font-medium">Dose (mg / norm)</th>
                      <th className="px-4 py-2 text-left font-medium">Effectiveness</th>
                      <th className="px-4 py-2 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((entry, index) => {
                      const isSelected = selectedId === entry.id
                      return (
                        <tr
                          key={entry.id ?? index}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-purple-600/10 ring-1 ring-inset ring-purple-500/40"
                              : index % 2 === 0
                                ? "bg-zinc-950"
                                : "bg-zinc-900/60"
                          } hover:bg-zinc-800/60`}
                          onMouseEnter={() => setHoveredId(entry.id)}
                          onClick={() => setSelectedId(entry.id)}
                          tabIndex={0}
                          role="button"
                          aria-pressed={isSelected}
                        >
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">{entry.date}</td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">{entry.bodyPart}</td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">{entry.intensity}</td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">{entry.medication}</td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">
                            {entry.doseMg} mg / {entry.normalizedDose}
                          </td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">{entry.effectiveness}</td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">{entry.notes}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-400">No data available for the selected year</div>
            )}
          </div>
        </div>

        <aside className="sticky top-4 h-max rounded-lg border border-zinc-800 bg-zinc-950 p-4" aria-live="polite">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Details</h3>
            {selectedId ? (
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-md px-2 py-1 text-xs text-zinc-300 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800/60"
              >
                Clear
              </button>
            ) : null}
          </div>
          {(() => {
            const activeId = selectedId || hoveredId
            if (!activeId)
              return <div className="text-sm text-zinc-400">Hover or click a point/row to see details.</div>
            const log = idToLog.get(activeId)
            if (!log) return <div className="text-sm text-zinc-400">No details found.</div>

            const firstPart = log.body_parts?.[0]
            const dateStr = (() => {
              try {
                const d = new Date((log as any).parsed_date ?? log.timestamp)
                return isNaN(d.getTime()) ? log.timestamp : format(d, "PPpp")
              } catch {
                return log.timestamp
              }
            })()

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">{dateStr}</div>
                  <div className="flex items-center gap-2">
                    {selectedId ? (
                      <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300 ring-1 ring-inset ring-purple-500/30">
                        Pinned
                      </span>
                    ) : null}
                    <span
                      className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300 ring-1 ring-inset ring-purple-500/30"
                      title="General pain flag (0-10)"
                    >
                      Flag: {log.general_flag}
                    </span>
                  </div>
                </div>

                {log.ai_summary ? (
                  <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
                    <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">AI Summary</div>
                    <p className="text-sm text-zinc-200">{log.ai_summary}</p>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Body Parts</div>
                  {log.body_parts?.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {log.body_parts.map((bp, i) => (
                        <li
                          key={`${bp.body_part}-${i}`}
                          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-200">{bp.body_part}</span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                              Intensity {bp.intensity}
                            </span>
                          </div>
                          {bp.notes ? <div className="mt-1 text-[11px] text-zinc-400">“{bp.notes}”</div> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-zinc-400">No body part details</div>
                  )}
                </div>

                <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
                  <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Medication</div>
                  {log.medication?.taking ? (
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-zinc-400">Name</dt>
                      <dd className="text-zinc-200">{log.medication?.name}</dd>
                      <dt className="text-zinc-400">Dose</dt>
                      <dd className="text-zinc-200">{String(log.medication?.dose)} mg</dd>
                      <dt className="text-zinc-400">Effectiveness</dt>
                      <dd className="text-zinc-200">{log.medication?.effectiveness}</dd>
                    </dl>
                  ) : (
                    <div className="text-sm text-zinc-400">No medication taken</div>
                  )}
                </div>
              </div>
            )
          })()}
        </aside>
      </section>
    </main>
  )
}
