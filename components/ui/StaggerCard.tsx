"use client"

import { motion } from "framer-motion"

// Used in a parent with staggerChildren; consistent theme and spacing.

export default function StaggerCard({ title, body }: { title: string; body: string }) {
  return (
    <motion.article
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6"
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      }}
      aria-label={title}
    >
      <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-zinc-400">{body}</p>
    </motion.article>
  )
}
