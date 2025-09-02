"use client"

import dynamic from "next/dynamic"

const SignInClient = dynamic(() => import("@clerk/nextjs").then((m) => m.SignIn), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-48 w-48 items-center justify-center rounded-xl border border-zinc-200 bg-white"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading sign-in</span>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-[hsl(274,71%,58%)]" />
    </div>
  ),
})

const DitheringClient = dynamic(() => import("@paper-design/shaders-react").then((m) => m.Dithering), { ssr: false })

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-white text-zinc-900">
      {/* Container */}
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        {/* Left: 3/4 - Centered Sign In */}
        <section className="flex w-full flex-1 items-center justify-center p-6 md:basis-3/4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white/70 p-6 shadow-lg shadow-zinc-300/30 backdrop-blur">
            {/* Optional heading for clarity (kept minimal) */}
            <h1 className="mb-6 text-center text-pretty text-2xl font-semibold tracking-tight">Welcome back</h1>

            {/* Clerk SignIn component with purple accents on a light background */}
            <div className="flex items-center justify-center">
              <SignInClient
                appearance={{
                  variables: {
                    colorPrimary: "hsl(274, 71%, 58%)",
                    colorBackground: "#fff",
                    colorText: "#18181b", // zinc-900
                    colorInputBackground: "#f4f4f5", // zinc-100
                    colorInputText: "#18181b",
                    borderRadius: "12px",
                  },
                  elements: {
                    card: "bg-white border border-zinc-200 shadow-none",
                    formButtonPrimary:
                      "bg-[hsl(274,71%,58%)] hover:bg-[hsl(274,71%,50%)] focus-visible:ring-2 focus-visible:ring-[hsl(274,71%,58%)] text-white",
                    formButtonReset: "text-zinc-900",
                    formButton: "text-zinc-900",
                    headerTitle: "text-zinc-900",
                    headerSubtitle: "text-zinc-500",
                    formFieldLabel: "text-zinc-700",
                    formFieldInput: "bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400",
                    footerAction__signIn: "text-zinc-500",
                    footerActionLink: "text-[hsl(274,71%,58%)] hover:text-[hsl(274,71%,50%)]",
                  },
                }}
              />
            </div>
          </div>
        </section>

        {/* Right: 1/4 - Shader panel (hidden on small screens) */}
        <aside className="hidden h-screen w-100 items-stretch justify-stretch border-t border-zinc-200 md:flex md:basis-1/4 md:border-t-0 md:border-l">
          <div className="relative h-full w-full">
            {/* Ensure the shader fills this panel */}
            <div className="absolute inset-0">
              <DitheringClient
                style={{ height: "100%", width: "100%" }}
                colorBack="hsla(0, 0%, 100%, 0)" // transparent white
                colorFront="hsl(274, 71%, 58%)"
                shape="swirl"
                type="8x8"
                pxSize={2}
                offsetX={0}
                offsetY={0}
                scale={1}
                rotation={0}
                speed={1}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
  