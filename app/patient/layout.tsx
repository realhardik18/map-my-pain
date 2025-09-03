
"use client"
import Link from "next/link"
import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { MdHome, MdHistory, MdDescription, MdMap, MdNote, MdLogout } from "react-icons/md"
import { SignedIn, SignedOut, useUser, SignOutButton, SignInButton, SignUpButton } from "@clerk/nextjs"

const nav = [
  { href: "/patient", label: "Home", icon: MdHome },
  { href: "/patient/history", label: "History", icon: MdHistory },
  { href: "/patient/my-docs", label: "My Reports", icon: MdDescription },
  { href: "/patient/pain-map", label: "Pain Map", icon: MdMap },
  { href: "/patient/log", label: "Log", icon: MdNote },
]

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { user, isLoaded } = useUser()

  // Redirect unauthenticated users to /login
  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/sign-in")
    }
  }, [user, isLoaded, router])

  // Do not apply layout for /patient/log
  if (pathname === "/patient/log") {
    return <>{children}</>
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-dvh bg-black text-zinc-200">
          <div className="flex">
            <aside
              className={cn(
                "h-dvh sticky top-0 border-r border-zinc-800 bg-black",
                "transition-all duration-300 ease-in-out",
                collapsed ? "w-16" : "w-72",
                "flex flex-col"
              )}
            >
              <div className="flex items-center justify-between px-4 py-4">
                <Link href="/patient" className="font-bold text-balance tracking-tight">
                  <span className={cn("text-violet-400 text-lg", collapsed && "sr-only")}>My Pain Map</span>
                  <span className={cn(!collapsed && "sr-only text-violet-400 text-lg")}>MP</span>
                </Link>
                <button
                  onClick={() => setCollapsed((v) => !v)}
                  className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                  aria-pressed={collapsed}
                  aria-label="Toggle sidebar"
                >
                  {collapsed ? "›" : "‹"}
                </button>
              </div>

              <nav className="px-2 mt-2 flex-1">
                <div className={cn("mb-2 text-xs font-semibold text-zinc-400", collapsed && "sr-only")}>Navigation</div>
                <ul className={cn("space-y-1", collapsed && "space-y-2")}> 
                  {nav.map((item) => {
                    const active = pathname === item.href
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            "hover:bg-violet-950/60 hover:text-violet-200",
                            active ? "bg-violet-900 text-white shadow" : "text-zinc-300",
                            collapsed && "justify-center"
                          )}
                        >
                          <Icon className={cn("text-xl", collapsed ? "mx-auto" : "mr-2")} aria-hidden />
                          <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="px-2 mt-4 mb-2 flex items-center gap-3 py-2">
                <SignedIn>
                  {user && (
                    <>
                      <img
                        src={user.imageUrl}
                        alt="Profile"
                        className={cn("size-8 rounded-full", collapsed && "mx-auto")}
                      />
                      <div className={cn("min-w-0 flex-1", collapsed && "sr-only")}> 
                        <p className="text-sm font-medium">{user.fullName || user.username}</p>
                        <p className="truncate text-xs text-zinc-400">{user.primaryEmailAddress?.emailAddress}</p>
                      </div>
                      <SignOutButton>
                        <button
                          className={cn(
                            "rounded-md px-2 py-2 text-zinc-300 hover:bg-zinc-900 transition flex items-center justify-center",
                            collapsed && "px-2"
                          )}
                          title="Logout"
                        >
                          <MdLogout className="text-lg" />
                          <span className={cn("ml-2 text-sm", collapsed && "sr-only")}>Logout</span>
                        </button>
                      </SignOutButton>
                    </>
                  )}
                </SignedIn>
                <SignedOut>
                  <div className={cn("flex flex-col w-full", collapsed && "items-center")}> 
                    <SignInButton>
                      <button className="bg-violet-700 text-white rounded-md font-medium text-sm px-3 py-2 mb-2 w-full">Sign In</button>
                    </SignInButton>
                    <SignUpButton>
                      <button className="bg-violet-950 text-white rounded-md font-medium text-sm px-3 py-2 w-full">Sign Up</button>
                    </SignUpButton>
                  </div>
                </SignedOut>
              </div>
            </aside>

            <main className="flex-1">{children}</main>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        {/* Redirect handled by useEffect above */}
      </SignedOut>
    </>
  )
}