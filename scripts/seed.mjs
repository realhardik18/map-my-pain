// Seeds the local MongoDB with demo users, patient records and pain logs.
// Usage: npm run seed   (wipes the users, records and logs collections first)

import { MongoClient } from "mongodb"
import { randomBytes, scryptSync } from "crypto"

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mapmypain"

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex")
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`
}

// Deterministic PRNG so every seed run produces the same demo data
let state = 42
function rand() {
  state = (state * 1664525 + 1013904223) % 4294967296
  return state / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const round1 = (n) => Math.round(n * 10) / 10
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

const ADMIN = { email: "admin@demo.local", name: "Dr. Kavita Mehta", password: "admin123" }

// Body part names match the mesh names in public/models/human.fbx so the 3D view can highlight them
const PATIENTS = [
  {
    email: "priya@demo.local",
    name: "Priya Sharma",
    context: `Patient: Priya Sharma (ID MMP-1001), 29 y/o female, software engineer.
History: Chronic tension-type headaches for ~3 years, worse during long screen sessions. Neck and upper trapezius stiffness, right side dominant. No history of trauma.
Imaging: Cervical X-ray (2024) unremarkable; mild loss of cervical lordosis.
Medications: Ibuprofen 400 mg PRN, Paracetamol 500 mg PRN. Allergies: none known.
Plan: Physiotherapy twice weekly, ergonomic workstation review, track triggers (sleep, screen time, stress).`,
    parts: ["neck", "trap_right", "trap_left", "head_back", "head_top"],
    meds: [
      { name: "Ibuprofen", dose: 400 },
      { name: "Paracetamol", dose: 500 },
    ],
    types: ["dull", "aching", "tight", "pressing"],
    notes: [
      "Stiff after a long day at the laptop.",
      "Tightness spreading from neck to the back of the head.",
      "Better after stretching and a hot shower.",
      "Woke up with it after poor sleep.",
      "Started mid-afternoon during deadline week.",
    ],
    start: 7.5,
    trend: -0.12,
  },
  {
    email: "rahul@demo.local",
    name: "Rahul Verma",
    context: `Patient: Rahul Verma (ID MMP-1002), 41 y/o male, teacher.
History: Temporomandibular joint (TMJ) dysfunction diagnosed 2023. Nocturnal bruxism reported by spouse. Clicking in left jaw, occasional ear fullness.
Dental: Night guard prescribed 2024, inconsistent use.
Medications: Naproxen 250 mg PRN, muscle relaxant (Cyclobenzaprine 5 mg) at night during flares.
Plan: Soft diet during flares, jaw exercises, stress management, dental follow-up every 6 months.`,
    parts: ["chin_jaw", "ears", "face_front"],
    meds: [
      { name: "Naproxen", dose: 250 },
      { name: "Cyclobenzaprine", dose: 5 },
    ],
    types: ["aching", "sharp", "throbbing"],
    notes: [
      "Jaw sore on waking, probably grinding at night.",
      "Clicking when chewing, sharp twinge on the left.",
      "Ear feels full on the left side.",
      "Worse after a long day of lecturing.",
      "Eased after warm compress.",
    ],
    start: 6,
    trend: -0.05,
  },
  {
    email: "ananya@demo.local",
    name: "Ananya Iyer",
    context: `Patient: Ananya Iyer (ID MMP-1003), 35 y/o female, graphic designer.
History: Migraine without aura since adolescence, ~3-4 episodes/month. Triggers: missed meals, bright light, menstrual cycle. Photophobia and nausea during attacks.
Neurology review (2025): normal exam, MRI brain normal.
Medications: Sumatriptan 50 mg at onset, Propranolol 40 mg daily (prophylaxis, started March 2025).
Plan: Headache diary, regular sleep and meals, review prophylaxis efficacy at 6 months.`,
    parts: ["head_top", "eyes_nose", "face_front", "head_back"],
    meds: [
      { name: "Sumatriptan", dose: 50 },
      { name: "Propranolol", dose: 40 },
    ],
    types: ["throbbing", "pulsating", "stabbing"],
    notes: [
      "Throbbing behind the right eye, light sensitive.",
      "Nausea with the headache, had to lie down in a dark room.",
      "Skipped lunch, headache came on in the evening.",
      "Started on waking, eased after medication.",
      "Mild today, just pressure around the eyes.",
    ],
    start: 8,
    trend: -0.15,
  },
]

const EFFECTIVENESS = ["none", "mild relief", "moderate relief", "good relief"]

function buildLogs(patient) {
  const logs = []
  const count = 24
  const now = new Date("2026-10-18T10:00:00Z")
  // Spread logs over the last ~16 months, roughly every 2-3 weeks
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.round((count - i) * 20 + rand() * 6)
    const ts = new Date(now.getTime() - daysAgo * 86400000)
    ts.setUTCHours(7 + Math.floor(rand() * 13), Math.floor(rand() * 60), 0, 0)

    // One recent severe flare per patient so the emergency flag shows up in the demo
    const flare = i === count - 3
    const base = flare ? 9.4 : clamp(patient.start + patient.trend * i + (rand() - 0.5) * 2.5, 1, 10)
    const partCount = 1 + Math.floor(rand() * 2)
    const parts = [...patient.parts].sort(() => rand() - 0.5).slice(0, partCount)
    const body_parts = parts.map((p, j) => ({
      body_part: p,
      intensity: round1(clamp(base - j * (0.5 + rand()), 1, 10)),
      notes: pick(patient.notes),
      types: [...patient.types].sort(() => rand() - 0.5).slice(0, 2),
    }))

    const taking = rand() > 0.3
    const med = pick(patient.meds)
    const medication = taking
      ? { taking: true, name: med.name, dose: String(med.dose * (rand() > 0.8 ? 2 : 1)), effectiveness: pick(EFFECTIVENESS) }
      : { taking: false, name: "", dose: "0", effectiveness: "" }

    const peak = Math.max(...body_parts.map((b) => b.intensity))
    const general_flag = peak >= 9 ? 1 : 0
    const partsText = body_parts.map((b) => `${b.body_part.replace("_", " ")} (${b.intensity}/10)`).join(" and ")
    const ai_summary =
      `Patient reports ${body_parts[0].types.join(", ")} pain in the ${partsText}. ${body_parts[0].notes} ` +
      (taking ? `Took ${medication.name} ${medication.dose} mg with ${medication.effectiveness}.` : "No medication taken.") +
      (general_flag ? " High intensity — flagged for clinician review." : "")

    const dateStr = ts.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })
    const pdf_data = `# Pain Report

- **Patient:** ${patient.name}
- **Email:** ${patient.email}
- **Date:** ${dateStr} (UTC)

## Background
${patient.context.split("\n").slice(1, 3).join(" ")}

## Current Issue
${ai_summary}

## Body Parts Affected
| Body part | Intensity | Type | Notes |
| --- | --- | --- | --- |
${body_parts.map((b) => `| ${b.body_part} | ${b.intensity}/10 | ${b.types.join(", ")} | ${b.notes} |`).join("\n")}

## Medication
${taking ? `- **Name:** ${medication.name}\n- **Dose:** ${medication.dose} mg\n- **Effectiveness:** ${medication.effectiveness}` : "No medication taken for this episode."}

## Summary
${general_flag ? "⚠️ Severe pain reported. Recommend clinician follow-up." : "Pain within the patient's usual range. Continue current plan and monitoring."}
`

    logs.push({
      patient_email: patient.email,
      timestamp: ts.toISOString(),
      body_parts,
      mesh_highlights: body_parts.map((b) => ({ mesh_id: b.body_part, score: b.intensity })),
      general_flag,
      ai_summary,
      pdf_data,
      medication,
    })
  }
  return logs
}

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
  } catch (err) {
    console.error(`Could not connect to MongoDB at ${uri}. Is it running? Try: npm run db:up`)
    console.error(err.message)
    process.exit(1)
  }
  const db = client.db()

  await Promise.all(["users", "records", "logs"].map((c) => db.collection(c).deleteMany({})))
  await db.collection("users").createIndex({ email: 1 }, { unique: true })
  await db.collection("records").createIndex({ patient_email: 1 }, { unique: true })
  await db.collection("logs").createIndex({ patient_email: 1, timestamp: 1 })

  await db.collection("users").insertMany([
    { email: ADMIN.email, name: ADMIN.name, role: "admin", passwordHash: hashPassword(ADMIN.password) },
    ...PATIENTS.map((p) => ({ email: p.email, name: p.name, role: "patient", passwordHash: hashPassword("patient123") })),
  ])
  await db.collection("records").insertMany(PATIENTS.map((p) => ({ patient_email: p.email, context: p.context })))

  let total = 0
  for (const p of PATIENTS) {
    const logs = buildLogs(p)
    await db.collection("logs").insertMany(logs)
    total += logs.length
  }

  console.log(`Seeded ${db.databaseName}: 1 admin, ${PATIENTS.length} patients, ${total} pain logs.\n`)
  console.log("Logins:")
  console.log(`  admin    ${ADMIN.email} / ${ADMIN.password}`)
  for (const p of PATIENTS) console.log(`  patient  ${p.email} / patient123`)
  await client.close()
}

main()
