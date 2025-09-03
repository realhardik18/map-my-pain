'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type RecordItem = {
  patient_email: string
  context: string
  _id?: any
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function Admin() {
  const { data, mutate } = useSWR<RecordItem[]>('/api/record', fetcher)
  const records = Array.isArray(data) ? data : []

  const [email, setEmail] = useState('')
  const [contextText, setContextText] = useState('')
  const [status, setStatus] = useState('')

  const patients = useMemo(() => {
    const map = new Map<string, RecordItem>()
    records.forEach((r) => {
      if (!map.has(r.patient_email)) map.set(r.patient_email, r)
    })
    return Array.from(map.values())
  }, [records])

  async function addPatient(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!email) return
    setStatus('Adding...')
    try {
      const res = await fetch('/api/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_email: email, context: '' }),
      })
      if (!res.ok) throw new Error('failed')
      setEmail('')
      await mutate()
      setStatus('Added')
    } catch (err) {
      setStatus('Error adding patient')
    }
  }

  async function uploadFile(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !contextText) return
    setStatus('Adding patient...')
    try {
      const res = await fetch('/api/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_email: email, context: contextText }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setStatus('Patient added successfully')
        setContextText('')
        setEmail('')
        await mutate()
      } else {
        setStatus(json?.error || 'Failed to add patient')
      }
    } catch (err) {
      setStatus('Error adding patient')
    }
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight">Admin Portal</h1>
        </header>

        <section className="mb-6">
          <form onSubmit={uploadFile} className="flex flex-wrap items-start gap-2">
            <div className="flex-grow min-w-[200px]">
              <Input 
                placeholder="Patient email" 
                value={email} 
                onChange={(e) => setEmail((e.target as any).value)} 
                className="h-10"
                required
              />
            </div>
            <div className="flex-grow min-w-[300px]">
              <textarea
                placeholder="Paste context text here"
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                className="min-h-[40px] w-full resize-y rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                required
              />
            </div>
            <div>
              <button 
                type="submit" 
                className="rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 transition-colors"
              >
                Add Patient
              </button>
            </div>
          </form>
        </section>

        <section aria-label="Patients table" className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
          {patients.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No patients found.</div>
          ) : (
            <Table>
              <TableCaption className="text-zinc-400">Showing {patients.length} patients</TableCaption>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-300">Patient Email</TableHead>
                  <TableHead className="text-zinc-300">Context Summary</TableHead>
                  <TableHead className="text-zinc-300 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p, i) => (
                  <TableRow key={i} className="border-zinc-900/80">
                    <TableCell className="align-top text-zinc-200">{p.patient_email}</TableCell>
                    <TableCell className="align-top text-zinc-300">
                      <p className="max-w-xl text-pretty leading-relaxed">{p.context ? p.context.slice(0, 300) : '—'}</p>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <a 
                        href={`/admin/view/${encodeURIComponent(p.patient_email)}`}
                        className="inline-block rounded-md bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-700 transition-colors"
                      >
                        View Profile
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <div className={cn("mt-4 px-2 py-1 rounded-md", {
          "bg-green-800/40 text-green-300": status === "Patient added successfully",
          "bg-red-800/40 text-red-300": status.includes("Error") || status.includes("Failed"),
          "bg-zinc-800/40 text-zinc-300": status === "Adding patient..."
        })}>
          {status}
        </div>
      </div>
    </main>
  )
}
