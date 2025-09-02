"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

// Accepts optional Icon, title, description. Dark + purple theme with subtle hover.

export default function FeatureCard({
  title,
  description,
  Icon,
}: {
  title: string
  description: string
  Icon?: LucideIcon
}) {
  return (
    <motion.article
      className="group relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 transition hover:bg-zinc-950/90"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-label={title}
    >
      {/* Accent stripe */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(278,66%,38%)]/50 to-transparent" />

      <div className="flex items-start gap-4">
        {Icon ? (
          <div className="mt-1 rounded-md border border-[hsl(278,66%,38%)]/30 bg-[hsl(278,66%,38%)]/10 p-2 text-[hsl(278,66%,38%)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : null}

        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          <p className="mt-2 text-zinc-400">{description}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-[hsl(278,66%,38%)]">
        <span className="rounded-md bg-[rgba(124,58,237,0.12)] px-2 py-1">Learn more</span>
      </div>
    </motion.article>
  )
}
