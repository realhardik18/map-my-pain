import { NextRequest, NextResponse } from "next/server"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
	if (!GEMINI_API_KEY) {
		return NextResponse.json({ error: "Missing Gemini API key" }, { status: 500 })
	}
	const body = await req.json();
	const { messages } = body;
	if (!Array.isArray(messages)) {
		return NextResponse.json({ error: "Missing messages array" }, { status: 400 })
	}

	// Convert messages to Gemini format
	const contents = messages.map((m: any) => ({
		role: m.role === "user" ? "user" : "model",
		parts: [{ text: m.text }],
	}));

	try {
		const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contents }),
			}
		);
		if (!res.ok) {
			const error = await res.text();
			return NextResponse.json({ error }, { status: res.status })
		}
		const data = await res.json();
		// Extract model response
		const modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(No response)";
		return NextResponse.json({ text: modelText })
	} catch (err: any) {
		return NextResponse.json({ error: String(err) }, { status: 500 })
	}
}
