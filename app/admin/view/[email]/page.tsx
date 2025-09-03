'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function ViewPatient() {
  const params = useParams()
  const email = Array.isArray(params.email) ? params.email[0] : params.email

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight">Patient Profile</h1>
          <Link 
            href="/admin" 
            className="rounded-md bg-zinc-800 px-4 py-2 text-white hover:bg-zinc-700 transition-colors"
          >
            Back to Admin
          </Link>
        </header>

        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-medium text-zinc-300 mb-2">Patient Information</h2>
            <div className="bg-zinc-900 p-4 rounded-md">
              <p className="text-zinc-200">
                <span className="text-zinc-400">Email: </span>
                {email ? decodeURIComponent(email) : 'Loading...'}
              </p>
            </div>
          </div>
          
          {/* Additional patient details can be added here */}
        </section>
      </div>
    </main>
  )
}
