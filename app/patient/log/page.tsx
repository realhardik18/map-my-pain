"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import * as THREE from "three"
import { FBXLoader } from "three-stdlib"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Focus,
  Maximize2,
  Highlighter,
  MessageSquarePlus,
  Search,
  Loader2,
  Sparkles,
  Undo2,
} from "lucide-react"

type SceneHandle = {
  frameAll: () => void
  frameByName: (name: string | null) => void
  frameByNames: (names: string[]) => void
  getMeshNames: () => string[]
}

type ChatMessage = { role: "user" | "assistant"; text: string }

export default function HumanPage() {
  // Model path state (kept for parity; UI focuses on current default path)
  const [fbxPath] = useState("/models/human.fbx")

  // Selection + highlighting
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  // Mesh discovery and search
  const [meshNames, setMeshNames] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  const sceneRef = useRef<SceneHandle>(null)

  // Model loading indicator from Scene
  const [modelLoading, setModelLoading] = useState(false)

  // Chat state
  const [chatOpen, setChatOpen] = useState(true)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Hi! How can I help you?" }])
  const [chatLoading, setChatLoading] = useState(false)

  // State for info tab hover
  const [showInstructions, setShowInstructions] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    // Auto-scroll chat on new message
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, chatOpen])

  const refreshMeshNames = useCallback(() => {
    startTransition(() => {
      const names = sceneRef.current?.getMeshNames() ?? []
      setMeshNames(names)
    })
  }, [startTransition])

  const sendChat = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const userMsg: ChatMessage = { role: "user", text: text.trim() }
      setMessages((prev) => [...prev, userMsg])
      setChatInput("")
      setChatLoading(true)
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMsg] }),
        })
        const data = await res.json()
        if (data?.text) {
          setMessages((prev) => [...prev, { role: "assistant", text: data.text }])
        } else {
          setMessages((prev) => [...prev, { role: "assistant", text: "(No response)" }])
        }
      } catch (err: any) {
        setMessages((prev) => [...prev, { role: "assistant", text: "Error: " + String(err) }])
      } finally {
        setChatLoading(false)
      }
    },
    [messages],
  )

  const addSelectedToChat = useCallback(() => {
    const parts = Array.from(selected)
    if (parts.length === 0) return
    sendChat(`Selected parts: ${parts.join(", ")}`)
  }, [selected, sendChat])

  // Keyboard shortcuts
  // useEffect(() => {
  //   const onKey = (e: KeyboardEvent) => {
  //     const k = e.key.toLowerCase()
  //     if (k === "h") {
  //       if (selected.size > 0) {
  //         setHighlighted((prev) => {
  //           const next = new Set(prev)
  //           for (const name of selected) {
  //             if (next.has(name)) next.delete(name)
  //             else next.add(name)
  //           }
  //           return next
  //         })
  //       }
  //     } else if (k === "c") {
  //       setHighlighted(new Set())
  //     } else if (k === "f") {
  //       sceneRef.current?.frameByNames(Array.from(selected))
  //     }
  //   }
  //   window.addEventListener("keydown", onKey)
  //   return () => window.removeEventListener("keydown", onKey)
  // }, [selected])

  const filteredNames = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return meshNames
    return meshNames.filter((n) => n.toLowerCase().includes(s))
  }, [meshNames, search])

  // Remove mesh search/filter and mesh list UI
  // Only show selected meshes in the left panel
  const SelectedMeshList = useMemo(
    () =>
      selected.size === 0 ? (
        <div className="p-4 text-sm text-zinc-400">No parts selected.</div>
      ) : (
        <ul className="divide-y divide-zinc-800" role="list" aria-label="Selected mesh list">
          {Array.from(selected).map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 p-2">
              <span className="flex-1 text-left text-sm truncate rounded px-2 py-1 font-semibold text-violet-400 bg-zinc-900">{name}</span>
              <button
                className="ml-2 text-xs text-zinc-400 hover:text-red-500"
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    next.delete(name)
                    return next
                  })
                }
                title="Deselect"
              >
                Deselect
              </button>
            </li>
          ))}
        </ul>
      ),
    [selected, setSelected],
  )

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <section className="flex min-h-screen">
        {/* LEFT PANEL */}
        <aside
          className="w-80 md:w-96 border-r border-zinc-800 p-4 flex flex-col gap-4 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden"
          style={{ minWidth: "240px", maxWidth: "384px" }}
          aria-label="Pain map controls"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-pretty text-lg md:text-xl font-semibold tracking-tight">my pain map</h2>
            <div className="flex items-center gap-2">
              {modelLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  Loading
                </span>
              )}
            </div>
          </div>

          <div>
            <Link
              href="/patient"
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <Undo2 className="size-4" aria-hidden />
              Back to Dashboard
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Selected Parts</span>{" "}
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300 border border-zinc-800">
                {selected.size}
              </span>
            </div>
          </div>

          {/* 2x2 grid for action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-200 border border-zinc-800 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
              onClick={() => sceneRef.current?.frameAll()}
              title="Reset View"
            >
              <Maximize2 className="size-4" aria-hidden />
              Reset Veiw
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-200 border border-zinc-800 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              onClick={() => sceneRef.current?.frameByNames(Array.from(selected))}
              disabled={selected.size === 0}
              title="Frame selected"
            >
              <Focus className="size-4" aria-hidden />
              Veiw Selected
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-500/90 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              onClick={() => setSelected(new Set())}
              title="Deselect all"
              disabled={selected.size === 0}
            >
              {/* Changed icon and label */}
              <Highlighter className="size-4" aria-hidden />
              Deselect all
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm text-white font-medium hover:bg-violet-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              onClick={addSelectedToChat}
              title="Send selected to chat"
              disabled={selected.size === 0}
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              Log Selected
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-300">Selected parts</label>
            </div>
            <div className="h-[38vh] overflow-auto rounded-md border border-zinc-800 bg-zinc-950">
              {modelLoading ? (
                <div className="flex items-center justify-center h-full text-sm text-zinc-400">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Loading meshes...
                </div>
              ) : (
                SelectedMeshList
              )}
            </div>
          </div>
        </aside>

        {/* CENTER - 3D VIEWER */}
        <div className="flex-1 relative overflow-hidden">
          {/* Info tab in top right */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end">
            <div
              className="bg-zinc-900/80 border border-zinc-800 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-violet-700 transition-colors"
              title="Show instructions"
              onMouseEnter={() => setShowInstructions(true)}
              onMouseLeave={() => setShowInstructions(false)}
              style={{ userSelect: "none" }}
            >
              <span className="text-white font-bold text-lg">i</span>
            </div>
            {showInstructions && (
              <div
                className="mt-2 bg-zinc-900/80 border border-zinc-800 rounded-md px-4 py-3 text-xs text-white shadow-lg w-[260px]"
                onMouseEnter={() => setShowInstructions(true)}
                onMouseLeave={() => setShowInstructions(false)}
              >
                <div className="font-semibold mb-2 text-sm">How to log your pain</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    <span className="font-medium">Select a part</span> on the 3D model (left click).
                  </li>
                  <li>
                    <span className="font-medium">Add selected part to chat</span> and answer questions the AI asks you.
                  </li>
                  <li>
                    <span className="font-medium">Log the pain</span> after answering.
                  </li>
                  <li>
                    <span className="font-medium">To deselect</span> a part, left click it again or use the "Deselect" button.
                  </li>
                </ol>
              </div>
            )}
          </div>
          <Canvas
            camera={{ position: [0, 1.6, 4], fov: 45, near: 0.1, far: 1000 }}
            onCreated={() => {
              setTimeout(refreshMeshNames, 600)
            }}
          >
            <color attach="background" args={["#0b0b0b"]} />
            <Scene
              ref={sceneRef}
              fbxPath={fbxPath}
              selected={selected}
              highlighted={highlighted}
              setSelected={setSelected}
              onMeshNames={(names) => setMeshNames(names)}
              onLoadingChange={setModelLoading}
            />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#ffffff", "#3a3a3a", 0.6]} />
            <directionalLight position={[5, 10, 5]} intensity={0.75} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.1} minDistance={0.2} />
          </Canvas>
        </div>

        {/* RIGHT - Collapsible Chat */}
        <aside
          className={`relative border-l border-zinc-800 transition-all duration-200 ease-in-out overflow-hidden ${
            chatOpen ? "w-80 md:w-96" : "w-[52px]"
          } bg-zinc-900/40 backdrop-blur-sm`}
          style={{ willChange: "width", minWidth: chatOpen ? "240px" : "52px", maxWidth: chatOpen ? "384px" : "52px" }}
          aria-label="Chat panel"
          aria-expanded={chatOpen}
        >
          <button
            className="group absolute -left-[26px] top-4 h-10 w-[26px] rounded-l-md bg-zinc-900 border border-zinc-800 text-xs text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
            onClick={() => setChatOpen((v) => !v)}
            aria-label={chatOpen ? "Collapse chat panel" : "Expand chat panel"}
            title={chatOpen ? "Collapse chat" : "Expand chat"}
            tabIndex={0}
          >
            {chatOpen ? (
              <ChevronLeft className="mx-auto size-4 transition-transform group-hover:-translate-x-px" aria-hidden />
            ) : (
              <ChevronRight className="mx-auto size-4 transition-transform group-hover:translate-x-px" aria-hidden />
            )}
          </button>

          <div
            className={`h-full flex flex-col ${chatOpen ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity duration-300`}
            style={{ minHeight: "100%", height: "100%", overflow: "hidden" }}
          >
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold tracking-tight">Chat</h3>
              <p className="text-xs text-zinc-400">Assistant will guide you through</p>
            </div>

            {/* Chat messages */}
            <div
              className="flex-1 overflow-y-auto p-3 space-y-2"
              style={{ maxHeight: "calc(100vh - 160px)", scrollBehavior: "smooth" }}
              aria-live="polite"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-zinc-900 border border-zinc-800 self-end ml-auto"
                      : "bg-violet-600 text-white font-medium"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form
              className="p-3 border-t border-zinc-800 flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!chatLoading) await sendChat(chatInput)
              }}
            >
              <input
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message"
                aria-label="Chat message"
                disabled={chatLoading}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm text-white font-medium hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                disabled={chatLoading}
              >
                {chatLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Sending
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden /> Send
                  </>
                )}
              </button>
            </form>
          </div>
        </aside>
      </section>
    </main>
  )
}

function SceneInner(
  props: {
    fbxPath: string
    selected: Set<string>
    highlighted: Set<string>
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
    onMeshNames: (names: string[]) => void
    onLoadingChange?: (loading: boolean) => void // new callback to report loading state
  },
  ref: React.Ref<SceneHandle>,
) {
  const { fbxPath, selected, highlighted, setSelected, onMeshNames, onLoadingChange } = props
  const groupRef = useRef<THREE.Group>(null)
  const controls = (useThree() as any).controls as import("three-stdlib").OrbitControls | undefined
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const [group, setGroup] = useState<THREE.Group | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const [hoveredName, setHoveredName] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setLoadError(null)
    setGroup(null)
    onLoadingChange?.(true) // propagate loading start
    const loader = new FBXLoader()
    loader.load(
      fbxPath,
      (g) => {
        if (canceled) return
        setGroup(g)
        setLoading(false)
        onLoadingChange?.(false) // done
      },
      undefined,
      (err) => {
        if (canceled) return
        setLoadError(err as any)
        setLoading(false)
        onLoadingChange?.(false) // done with error
      },
    )
    return () => {
      canceled = true
    }
  }, [fbxPath, onLoadingChange])

  const { meshesByName, meshNames } = useMemo(() => {
    const map = new Map<string, THREE.Mesh>()
    const names: string[] = []
    if (group) {
      let autoIndex = 0
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m: any) => (m?.isMaterial && m.clone ? m.clone() : m))
            } else {
              const m: any = mesh.material
              if (m?.isMaterial && m.clone) {
                mesh.material = m.clone()
              }
            }
          }
          let name = mesh.name && mesh.name.trim() ? mesh.name : `Mesh_${autoIndex++}`
          while (map.has(name)) name = `${name}_dup`
          map.set(name, mesh)
          mesh.userData.__name = name
          mesh.castShadow = true
          mesh.receiveShadow = true
          names.push(name)
        }
      })
    }
    return { meshesByName: map, meshNames: names }
  }, [group])

  useEffect(() => {
    onMeshNames(meshNames)
  }, [meshNames, onMeshNames])

  useEffect(() => {
    if (!groupRef.current) return
    frameObject(groupRef.current, camera, controls)
  }, [group, camera, controls])

  useEffect(() => {
    const el = gl.domElement
    // Remove pointer cursor on hover
    el.style.cursor = "auto"
  }, [gl.domElement, hoveredName])

  // Preserve original material colors/emissives to restore after highlight/hover
  useEffect(() => {
    meshesByName.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        const m = mat as any
        if (!m) return
        if (!m.userData) m.userData = {}
        if ("emissive" in m) {
          if (!m.userData.__origEmissive) {
            m.userData.__origEmissive = m.emissive?.clone?.() ?? new THREE.Color(0x000000)
          }
          if (typeof m.userData.__origEmissiveIntensity === "undefined") {
            m.userData.__origEmissiveIntensity = m.emissiveIntensity ?? 0
          }
        } else if ("color" in m) {
          if (!m.userData.__origColor) {
            m.userData.__origColor = m.color?.clone?.() ?? new THREE.Color(0xffffff)
          }
        }
      })
    })
  }, [meshesByName])

  // Apply highlight/selection/hover visual states
  useEffect(() => {
    meshesByName.forEach((mesh, name) => {
      // If hovered, turn green; else highlight/selected is red
      const isHovered = hoveredName === name
      const active = highlighted.has(name) || selected.has(name)
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        const m = mat as any
        if (!m) return
        if ("emissive" in m) {
          const orig = m.userData?.__origEmissive as THREE.Color | undefined
          const origI = m.userData?.__origEmissiveIntensity as number | undefined
          if (isHovered) {
            m.emissive = new THREE.Color("#22c55e") // green
            m.emissiveIntensity = 0.75
          } else if (active) {
            m.emissive = new THREE.Color("#ef4444") // red
            m.emissiveIntensity = 0.75
          } else {
            if (orig) m.emissive = orig instanceof THREE.Color ? orig.clone() : new THREE.Color(orig)
            if (typeof origI === "number") m.emissiveIntensity = origI
          }
          m.needsUpdate = true
        } else if ("color" in m) {
          const orig = m.userData?.__origColor as THREE.Color | undefined
          if (isHovered)
            m.color = new THREE.Color("#22c55e") // green
          else if (active)
            m.color = new THREE.Color("#ef4444") // red
          else if (orig) m.color = orig instanceof THREE.Color ? orig.clone() : new THREE.Color(orig)
          m.needsUpdate = true
        }
      })
    })
  }, [meshesByName, highlighted, selected, hoveredName])

  const onPointerMove = useCallback((e: any) => {
    const obj = e.object as THREE.Object3D | undefined
    if (!obj) {
      setHoveredName(null)
      return
    }
    const name = ((obj as any).userData && (obj as any).userData.__name) || obj.name || null
    setHoveredName(name)
  }, [])

  const onPointerOut = useCallback(() => setHoveredName(null), [])
  const onClick = useCallback(
    (e: any) => {
      e.stopPropagation()
      const obj = e.object as THREE.Object3D
      const name = ((obj as any).userData && (obj as any).userData.__name) || obj.name || null
      if (!name) return
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        return next
      })
    },
    [setSelected],
  )

  useEffect(() => {
    const handle: SceneHandle = {
      frameAll: () => frameObject(groupRef.current, camera, controls),
      frameByName: (name) => {
        if (!name) {
          frameObject(groupRef.current, camera, controls)
          return
        }
        const mesh = meshesByName.get(name)
        if (mesh) frameObject(mesh, camera, controls)
      },
      frameByNames: (names) => {
        if (!names || names.length === 0) {
          frameObject(groupRef.current, camera, controls)
          return
        }
        const box = new THREE.Box3()
        let hasAny = false
        names.forEach((n) => {
          const m = meshesByName.get(n)
          if (m) {
            if (!hasAny) {
              box.setFromObject(m)
              hasAny = true
            } else {
              const b = new THREE.Box3().setFromObject(m)
              box.union(b)
            }
          }
        })
        if (hasAny) frameBox3(box, camera, controls)
      },
      getMeshNames: () => meshNames,
    }
    if (typeof ref === "function") ref(handle)
    else if (ref) (ref as any).current = handle
  }, [camera, controls, meshesByName, meshNames, ref])

  return (
    <group ref={groupRef}>
      {loading && (
        <Html center>
          <div className="inline-flex items-center gap-2 rounded-md bg-zinc-900/70 px-3 py-2 text-sm text-white border border-violet-500/30">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading model…
          </div>
        </Html>
      )}
      {loadError && (
        <Html center>
          <div className="rounded-md bg-zinc-900/70 px-3 py-2 text-sm text-white border border-violet-500/30">
            Could not load: {String(loadError.message || loadError)}
          </div>
        </Html>
      )}

      {group && (
        <primitive object={group} onPointerMove={onPointerMove} onPointerOut={onPointerOut} onClick={onClick} />
      )}

      <Html position={[0, 2.2, 0]} center>
        <div className="rounded-md bg-zinc-900/70 px-2 py-1 text-xs text-white border border-zinc-800">
          {hoveredName
            ? `Hover: ${hoveredName}`
            : selected.size > 0
              ? `Selected: ${Array.from(selected).slice(0, 2).join(", ")}${
                  selected.size > 2 ? ` +${selected.size - 2} more` : ""
                }`
              : "Click meshes to select"}
        </div>
      </Html>
    </group>
  )
}

const Scene = React.forwardRef(SceneInner) as React.ForwardRefExoticComponent<
  Omit<Parameters<typeof SceneInner>[0], "ref"> & React.RefAttributes<SceneHandle>
>

function frameBox3(box: THREE.Box3, camera: THREE.Camera, controls?: import("three-stdlib").OrbitControls) {
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const maxDim = Math.max(size.x, size.y, size.z)
  const fitOffset = 1.6
  const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
    ? (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    : Math.PI / 4

  const distance = (maxDim / 2 / Math.tan(fov / 2)) * fitOffset

  const dir = new THREE.Vector3(0, 0.2, 1).normalize()
  const newPos = center.clone().add(dir.multiplyScalar(distance))
  camera.position.copy(newPos)

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }
  camera.lookAt(center)
}

function frameObject(
  obj: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  controls?: import("three-stdlib").OrbitControls,
) {
  if (!obj) return
  const box = new THREE.Box3().setFromObject(obj)
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const targetHeight = 2.2
  const scaleFactor = size.y > 0 ? targetHeight / size.y : 1
  const root = obj as THREE.Object3D
  if (root && root.parent === null) {
    root.scale.setScalar(scaleFactor)
    const sbox = new THREE.Box3().setFromObject(root)
    sbox.getSize(size)
    sbox.getCenter(center)
  }

  const maxDim = Math.max(size.x, size.y, size.z)
  const fitOffset = 1.6
  const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
    ? (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    : Math.PI / 4

  const distance = (maxDim / 2 / Math.tan(fov / 2)) * fitOffset

  const dir = new THREE.Vector3(0, 0.2, 1).normalize()
  const newPos = center.clone().add(dir.multiplyScalar(distance))

  camera.position.copy(newPos)

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }

  camera.lookAt(center)
}
