'use client'
import { useState } from "react"

export default function Admin() {
  const [input, setInput] = useState("")
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: input })
      });
      const data = await res.json();
      if (data.authed) {
        setAuthed(true);
      } else {
        setError("Incorrect password.");
      }
    } catch (err) {
      setError("Error connecting to server.");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
        <form onSubmit={handleSubmit} className="bg-zinc-900 p-8 rounded-lg shadow flex flex-col gap-4 min-w-[300px]">
          <h2 className="text-lg font-semibold">Admin Login</h2>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter admin password"
            className="rounded-md border border-zinc-700 bg-black px-3 py-2 text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-md bg-violet-600 px-4 py-2 text-white font-medium hover:bg-violet-500"
          >
            Login
          </button>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </form>
      </div>
    )
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <a>hello! welcome to admin portal</a>
    </div>
  )
}
