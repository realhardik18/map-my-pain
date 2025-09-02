export const overview = {
  appointments: 3,
  newMessages: 2,
  painLogs: 7,
  documents: 5,
}

export type HistoryItem = {
  id: string
  date: string
  title: string
  summary: string
}
export const history: HistoryItem[] = [
  { id: "h1", date: "2025-08-12", title: "Physio Session", summary: "Improved range of motion in left knee." },
  { id: "h2", date: "2025-08-03", title: "MRI Review", summary: "Minor inflammation around L4-L5." },
  { id: "h3", date: "2025-07-24", title: "Follow-up", summary: "Adjusted exercise plan and pain medication." },
]

export type DocItem = { id: string; name: string; date: string; kind: "PDF" | "Image" | "Note" }
export const docs: DocItem[] = [
  { id: "d1", name: "MRI Report.pdf", date: "2025-08-03", kind: "PDF" },
  { id: "d2", name: "Exercise Plan.pdf", date: "2025-07-24", kind: "PDF" },
  { id: "d3", name: "Back X-Ray.png", date: "2025-06-11", kind: "Image" },
]

export type PainLog = { id: string; date: string; areas: string[]; note?: string }
export const painLogs: PainLog[] = [
  { id: "p1", date: "2025-08-14", areas: ["Lower Back", "Left Knee"], note: "Worse after sitting." },
  { id: "p2", date: "2025-08-10", areas: ["Neck"], note: "Tension after long workday." },
]
