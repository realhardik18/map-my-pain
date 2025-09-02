"use client"

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import * as THREE from "three"
import { FBXLoader } from "three-stdlib"
import Link from "next/link"

type SceneHandle = {
  frameAll: () => void
  frameByName: (name: string | null) => void
  frameByNames: (names: string[]) => void
  getMeshNames: () => string[]
}

type ChatMessage = { role: "user" | "assistant"; text: string }

export default function HumanPage() {
  const [fbxPathInput, setFbxPathInput] = useState("/models/human.fbx")
  const [fbxPath, setFbxPath] = useState("/models/human.fbx")

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const sceneRef = useRef<SceneHandle>(null)
  const uploadedUrlRef = useRef<string | null>(null)

  const [meshNames, setMeshNames] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const refreshMeshNames = useCallback(() => {
    startTransition(() => {
      const names = sceneRef.current?.getMeshNames() ?? []
      setMeshNames(names)
    })
  }, [])

  const [chatOpen, setChatOpen] = useState(true)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "yes" }])
  const sendChat = useCallback(
    (text: string) => {
      if (!text.trim()) return
      setMessages((prev) => [...prev, { role: "user", text: text.trim() }, { role: "assistant", text: "yes" }])
      setChatInput("")
    },
    [setMessages],
  )
  const addSelectedToChat = useCallback(() => {
    const parts = Array.from(selected)
    if (parts.length === 0) return
    sendChat(`Selected parts: ${parts.join(", ")}`)
  }, [selected, sendChat])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === "h") {
        if (selected.size > 0) {
          setHighlighted((prev) => {
            const next = new Set(prev)
            for (const name of selected) {
              if (next.has(name)) next.delete(name)
              else next.add(name)
            }
            return next
          })
        }
      } else if (k === "c") {
        setHighlighted(new Set())
      } else if (k === "f") {
        sceneRef.current?.frameByNames(Array.from(selected))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected])

  const filteredNames = useMemo(() => {
    const s = search.trim().toLowerCase()
    const names = meshNames
    if (!s) return names
    return names.filter((n) => n.toLowerCase().includes(s))
  }, [meshNames, search])

  // Memoize mesh list for sidebar to avoid unnecessary re-renders
  const MeshList = useMemo(
    () =>
      filteredNames.length === 0 ? (
        <div className="p-3 text-sm text-[#94a3b8]">No meshes match.</div>
      ) : (
        <ul className="divide-y divide-[#1f2937]">
          {filteredNames.map((name) => {
            const isHighlighted = highlighted.has(name)
            const isSelected = selected.has(name)
            return (
              <li key={name} className="flex items-center justify-between gap-3 p-2">
                <button
                  className={`flex-1 text-left text-sm truncate ${
                    isSelected ? "font-semibold text-[#8b5cf6]" : ""
                  }`}
                  onClick={() => {
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(name)) next.delete(name)
                      else next.add(name)
                      return next
                    })
                  }}
                  title={name}
                >
                  {name}
                </button>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isHighlighted}
                    onChange={(e) =>
                      setHighlighted((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(name)
                        else next.delete(name)
                        return next
                      })
                    }
                    aria-label={`Highlight ${name}`}
                  />
                  <span className="text-xs text-[#94a3b8]">Highlight</span>
                </label>
              </li>
            )
          })}
        </ul>
      ),
    [filteredNames, highlighted, selected, setSelected, setHighlighted],
  )

  return (
    <main className="min-h-screen bg-[#000000] text-[#e5e7eb]">
      <section className="flex min-h-screen">
        {/* LEFT PANEL - "my pain map" - transparent, always open */}
        <aside
          className="w-80 md:w-96 border-r border-[#1f2937] p-4 flex flex-col gap-4 bg-black/30 backdrop-blur transition-all duration-300 ease-in-out overflow-hidden"
          style={{ minWidth: "240px", maxWidth: "384px" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-pretty text-lg md:text-xl font-semibold tracking-tight">my pain map</h2>
          </div>

          <div className="mb-4">
            <Link
              href="/patient"
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 transition"
            >
              ← Back to Dashboard
            </Link>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#cbd5e1]">FBX public path</label>
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-md border border-[#1f2937] bg-[#000000] px-3 py-2 text-sm placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6] transition-all"
                value={fbxPathInput}
                onChange={(e) => setFbxPathInput(e.target.value)}
                placeholder="/models/human.fbx"
                aria-label="FBX path"
                disabled={isPending}
              />
              <button
                className="rounded-md bg-[#8b5cf6] px-3 py-2 text-sm text-white font-medium hover:opacity-90"
                onClick={() => {
                  setFbxPath(fbxPathInput)
                  setTimeout(refreshMeshNames, 500)
                }}
                disabled={isPending}
              >
                {isPending ? "..." : "Load"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#94a3b8]">
              Place your file in public, e.g. public/models/human.fbx, then set the path to /models/human.fbx
            </p>
          </div>

          {meshNames.length === 0 && (
            <div className="rounded-md border border-[#8b5cf6]/40 bg-black/40 p-3">
              <p className="text-sm text-[#e5e7eb] mb-2">
                No model loaded. Choose a public path (e.g., /models/human.fbx) or upload an FBX file.
              </p>
              <input
                type="file"
                accept=".fbx"
                className="block w-full text-sm text-[#cbd5e1] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#8b5cf6] file:text-white hover:file:opacity-90"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (uploadedUrlRef.current) {
                    URL.revokeObjectURL(uploadedUrlRef.current)
                  }
                  const url = URL.createObjectURL(file)
                  uploadedUrlRef.current = url
                  setFbxPathInput(url)
                  setFbxPath(url)
                  setTimeout(refreshMeshNames, 800)
                }}
              />
              <p className="mt-1 text-xs text-[#94a3b8]">We load the file locally via a temporary URL.</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Meshes:</span> <span className="text-[#94a3b8]">{meshNames.length}</span>
            </div>
            <div className="text-xs text-[#94a3b8]">
              Selected: <span className="font-medium">{selected.size}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#cbd5e1]">Search parts</label>
            <input
              className="w-full rounded-md border border-[#1f2937] bg-[#000000] px-3 py-2 text-sm placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter meshes by name"
              aria-label="Search meshes"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] border border-[#1f2937] hover:bg-[#111827]"
              onClick={() => sceneRef.current?.frameAll()}
              title="Frame all"
            >
              Frame all
            </button>
            <button
              className="rounded-md bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] border border-[#1f2937] hover:bg-[#111827] disabled:opacity-50"
              onClick={() => sceneRef.current?.frameByNames(Array.from(selected))}
              disabled={selected.size === 0}
              title="Frame selected"
            >
              Frame selected
            </button>
            <button
              className="rounded-md bg-[#ef4444] px-3 py-2 text-sm text-white hover:opacity-90"
              onClick={() => setHighlighted(new Set())}
              title="Clear all highlights"
            >
              Clear highlights
            </button>
            <button
              className="rounded-md bg-[#8b5cf6] px-3 py-2 text-sm text-white font-medium hover:opacity-90 disabled:opacity-50"
              onClick={addSelectedToChat}
              title="Send selected to chat"
              disabled={selected.size === 0}
            >
              Add selected to chat
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[#cbd5e1]">Toggle highlights</label>
            <div className="h-[38vh] overflow-auto rounded-md border border-[#1f2937]">
              {MeshList}
            </div>
          </div>

          <div className="text-xs text-[#94a3b8]">
            Shortcuts: H = toggle highlight selected, F = frame selected, C = clear highlights
          </div>
        </aside>

        {/* CENTER - 3D VIEWER */}
        <div className="flex-1 relative overflow-hidden">
          <Canvas
            camera={{ position: [0, 1.6, 4], fov: 45, near: 0.1, far: 1000 }}
            onCreated={() => {
              setTimeout(refreshMeshNames, 600)
            }}
          >
            <color attach="background" args={["#000000"]} />
            <Scene
              ref={sceneRef}
              fbxPath={fbxPath}
              selected={selected}
              highlighted={highlighted}
              setSelected={setSelected}
              onMeshNames={(names) => setMeshNames(names)}
            />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#ffffff", "#3a3a3a", 0.6]} />
            <directionalLight position={[5, 10, 5]} intensity={0.75} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.1} minDistance={0.2} />
          </Canvas>
        </div>

        {/* RIGHT - Collapsible Chat */}
        <aside
          className={`relative border-l border-[#1f2937] transition-all duration-200 ease-in-out overflow-hidden ${
            chatOpen ? "w-80 md:w-96" : "w-[52px]"
          } bg-black/30 backdrop-blur`}
          style={{ willChange: "width", minWidth: chatOpen ? "240px" : "52px", maxWidth: chatOpen ? "384px" : "52px" }}
        >
          <button
            className="absolute -left-[26px] top-4 h-10 w-[26px] rounded-l-md bg-[#0f172a] border border-[#1f2937] text-xs text-white"
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Toggle chat panel"
            title="Toggle chat"
            tabIndex={0}
          >
            {chatOpen ? "<" : ">"}
          </button>

          <div
            className={`h-full flex flex-col ${chatOpen ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity duration-300`}
            style={{
              minHeight: "100%",
              height: "100%",
              overflow: "hidden",
              transition: "opacity 0.3s",
            }}
          >
            <div className="p-4 border-b border-[#1f2937]">
              <h3 className="text-sm font-semibold tracking-tight">Chat</h3>
              <p className="text-xs text-[#94a3b8]">Assistant will reply “yes” to every message.</p>
            </div>

            {/* Chat messages container */}
            <div
              className="flex-1 overflow-y-auto p-3 space-y-2"
              style={{ maxHeight: "calc(100vh - 160px)", scrollBehavior: "smooth" }}
              ref={(el) => {
                if (el) {
                  el.scrollTop = el.scrollHeight
                }
              }}
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[#0f172a] border border-[#1f2937] self-end ml-auto"
                      : "bg-[#8b5cf6] text-white font-medium"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <form
              className="p-3 border-t border-[#1f2937] flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                sendChat(chatInput)
              }}
            >
              <input
                className="flex-1 rounded-md border border-[#1f2937] bg-[#000000] px-3 py-2 text-sm placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message"
                aria-label="Chat message"
              />
              <button
                type="submit"
                className="rounded-md bg-[#8b5cf6] px-3 py-2 text-sm text-white font-medium hover:opacity-90"
              >
                Send
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
  },
  ref: React.Ref<SceneHandle>,
) {
  const { fbxPath, selected, highlighted, setSelected, onMeshNames } = props
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
    const loader = new FBXLoader()
    loader.load(
      fbxPath,
      (g) => {
        if (canceled) return
        setGroup(g)
        setLoading(false)
      },
      undefined,
      (err) => {
        if (canceled) return
        setLoadError(err as any)
        setLoading(false)
      },
    )
    return () => {
      canceled = true
    }
  }, [fbxPath])

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
  }, [group])

  useEffect(() => {
    const el = gl.domElement
    el.style.cursor = hoveredName ? "pointer" : "auto"
  }, [gl.domElement, hoveredName])

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

  useEffect(() => {
    meshesByName.forEach((mesh, name) => {
      const active = highlighted.has(name) || selected.has(name)
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        const m = mat as any
        if (!m) return
        if ("emissive" in m) {
          const orig = m.userData?.__origEmissive as THREE.Color | undefined
          const origI = m.userData?.__origEmissiveIntensity as number | undefined
          if (active) {
            m.emissive = new THREE.Color("#ef4444") // red
            m.emissiveIntensity = 0.75
          } else {
            if (orig) m.emissive = orig.clone()
            if (typeof origI === "number") m.emissiveIntensity = origI
          }
          m.needsUpdate = true
        } else if ("color" in m) {
          const orig = m.userData?.__origColor as THREE.Color | undefined
          if (active)
            m.color = new THREE.Color("#ef4444") // red
          else if (orig) m.color = orig.clone()
          m.needsUpdate = true
        }
      })
    })
  }, [meshesByName, highlighted, selected])

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
          <div className="rounded-md bg-black/60 px-3 py-2 text-sm text-white border border-[#8b5cf6]/40">
            Loading FBX…
          </div>
        </Html>
      )}
      {loadError && (
        <Html center>
          <div className="rounded-md bg-black/60 px-3 py-2 text-sm text-white border border-[#8b5cf6]/40">
            Could not load: {String(loadError.message || loadError)}
          </div>
        </Html>
      )}

      {group && (
        <primitive object={group} onPointerMove={onPointerMove} onPointerOut={onPointerOut} onClick={onClick} />
      )}

      <Html position={[0, 2.2, 0]} center>
        <div className="rounded-md bg-black/50 px-2 py-1 text-xs text-white">
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
