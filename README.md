# Map My Pain

Patients map where it hurts on a 3D head/neck model, talk it through with an AI assistant, and get a structured pain log + report. Clinicians (admins) manage patients and review their history, charts and reports.

Everything runs locally: Next.js + a local MongoDB + simple email/password auth. The AI assistant uses the OpenAI API (`gpt-4.1-mini` by default).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Environment** — copy the example and fill in your OpenAI key (https://platform.openai.com/api-keys):
   ```bash
   cp .env.example .env.local
   # then edit .env.local: set OPENAI_API_KEY and a random AUTH_SECRET
   ```
3. **Start MongoDB** — pick one:
   ```bash
   npm run db:local   # no Docker: downloads mongod into .mongo/ once, keep this terminal open
   npm run db:up      # or with Docker (docker-compose.yml)
   ```
4. **Seed demo data** (wipes and recreates users, records and logs):
   ```bash
   npm run seed
   ```
5. **Run the app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin / clinician | `admin@demo.local` | `admin123` |
| Patient (neck / tension headaches) | `priya@demo.local` | `patient123` |
| Patient (TMJ / jaw) | `rahul@demo.local` | `patient123` |
| Patient (migraine) | `ananya@demo.local` | `patient123` |

Each seeded patient has a medical background record and 24 pain logs spread over the last ~16 months.

## How it fits together

- `middleware.ts` — redirects signed-out visitors to `/sign-in`; `/admin/*` is admin-only, `/patient/*` is patient-only.
- `lib/session.ts`, `lib/auth.ts` — HMAC-signed session cookie, scrypt password hashes, API role checks.
- `app/api/record` — patient medical context (admin creates/edits; creating a patient also creates their login).
- `app/api/log` — pain logs (patients only ever see their own).
- `app/api/chat` — sends the conversation + patient context to OpenAI; when the model returns a complete log it is saved to MongoDB.
- `scripts/seed.mjs` — demo data. Body part names match the meshes in `public/models/human.fbx` so they highlight on the 3D model.

Change the model with `OPENAI_MODEL` in `.env.local`.
