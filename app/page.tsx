"use client"

import { useMemo } from "react"
import { Dithering } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Target, History, MessageSquareText } from "lucide-react"
import FeatureCard from "@/components/ui/FeatureCard"
import StaggerCard from "@/components/ui/StaggerCard"

export default function LandingPage() {
  const taglines = useMemo(
    () => ["Map pain. See patterns.", "Precision where it hurts.", "Highlight. Track. Heal."],
    [],
  )

  return (
    <main className="min-h-screen bg-black text-zinc-100 font-sans">
      {/* HERO with shader background */}
      <section className="relative overflow-hidden min-h-screen flex items-center">
        {/* Shader background */}
        <div className="absolute inset-0">
          <Dithering
            style={{ height: "100%", width: "100%" }}
            colorBack="hsl(0, 0%, 0%)"
            colorFront="hsl(287, 79%, 27%)"
            shape="warp"
            type="4x4"
            pxSize={2.5}
            offsetX={0}
            offsetY={0}
            scale={1}
            rotation={0}
            speed={1}
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black" />
        </div>

        {/* Content over shader */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-[hsl(287,79%,27%)]/30 bg-[hsl(287,79%,27%)]/10 px-3 py-1 text-xs md:text-sm text-zinc-200"
          >
            <span>Built for clarity</span>
          </motion.div>

          <motion.h1
            className="mt-4 text-balance text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Map My Pain
          </motion.h1>

          <motion.p
            className="mt-4 mx-auto max-w-2xl text-pretty text-lg md:text-2xl text-zinc-300"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
          >
            Visualize, track, and communicate your pain with precision and confidence.
          </motion.p>

          {/* rotating taglines */}
          <div className="mt-8 grid place-items-center gap-2">
            {taglines.map((line, i) => (
              <motion.div
                key={line}
                className="w-fit rounded-full px-3 py-1 text-sm md:text-base text-zinc-200"
                style={{
                  background: i % 2 === 0 ? "hsla(287,79%,27%,0.14)" : "hsla(287,79%,27%,0.08)",
                  border: "1px solid hsla(287,79%,27%,0.35)",
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12 * i }}
              >
                {line}
              </motion.div>
            ))}
          </div>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <Link
              href="/patient/pain-map"
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(287,79%,27%)] px-5 py-3 text-base font-medium text-white shadow-[0_8px_24px_rgba(126,34,206,0.25)] hover:opacity-95 transition"
            >
              Open Pain Map
            </Link>
            <Link
              href="/patient"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-base font-medium text-zinc-100 hover:bg-zinc-900/70 transition"
            >
              Go to Dashboard
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <motion.section
        className="mx-auto max-w-6xl px-6 py-20 md:py-28"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mb-10 md:mb-14">
          <h2 className="text-balance text-3xl md:text-4xl font-semibold">Why it works</h2>
          <div className="mt-3 h-px w-28 bg-[hsl(278,66%,38%)]/60" />
          <p className="mt-3 max-w-2xl text-zinc-400">
            Designed for clarity and speed—map pain precisely, track changes, and share insights with your care team.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Precision Mapping"
            description="Click to select multiple body regions and highlight them instantly in vivid detail."
            Icon={Target}
          />
          <FeatureCard
            title="Visual History"
            description="See how pain evolves over time with snapshots you can compare and share."
            Icon={History}
          />
          <FeatureCard
            title="Fast Communication"
            description="Turn your map into clear notes your clinician can understand at a glance."
            Icon={MessageSquareText}
          />
        </div>
      </motion.section>

      {/* Secondary Section with staggered cards */}
      <motion.section
        className="mx-auto max-w-6xl px-6 pb-28"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div
          className="grid gap-6 md:grid-cols-2"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
        >
          <StaggerCard
            title="Built for focus"
            body="A distraction-free, dark interface keeps attention on what matters—the body and your story."
          />
          <StaggerCard
            title="Your data, your control"
            body="Upload your 3D files or use ours. Quickly switch, compare, and keep everything organized."
          />
          <StaggerCard
            title="Works on your time"
            body="Start mapping now, add context later. Your progress is saved as you go."
          />
          <StaggerCard
            title="Made to share"
            body="Export your map with notes for clear, quick updates to your care team."
          />
        </motion.div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-zinc-500">
          © {new Date().getFullYear()} My Pain Map. All rights reserved.
        </div>
      </footer>
    </main>
  )
}
