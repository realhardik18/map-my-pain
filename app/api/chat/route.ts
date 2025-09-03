import { NextRequest, NextResponse } from "next/server"
import clientPromise from '@/lib/monogdb'

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT_TEXT = `
You are Map My Pain Assistant, a compassionate and structured AI companion that helps patients track, assess, and log their pain in detail.

Patient Context Variable:
{{PATIENT_CONTEXT}}
(This variable is the patient's medical report. Use it to guide your responses.)

Your goals:
- Always reply in JSON format with these fields:
    - type: (number) type of response (0 or 1).
    - content: (string) — the user-facing message.
    - data: (object, required only for type 1) — the structured log object (see interface below).
- Be empathetic and supportive, but focus on summarizing and logging the user's input efficiently.
- Avoid repetitive questions. Use the patient's context and prior answers to guide your responses.
- If enough information is provided, generate a complete log entry and stop asking further questions.

Response Types:
- Type 0 (Guidance): 
  {"type": 0, "content": "Supportive message summarizing the user's input or guiding them."}
- Type 1 (Pain log): 
  {
    "type": 1,
    "content": "Log entry created successfully.",
    "data": { ...Log object... }
  }

Schema Definitions:
export interface BodyPartLog {
  body_part: string;
  intensity: number;
  types: string[];
  onset: { when: string; mode: string };
  pattern: { constant_or_intermittent: string; frequency: string; timing: string };
  triggers: string[];
  relievers: string[];
  associated_symptoms: string[];
  medication: { taking: boolean; name: string; dose: string; effectiveness: string };
  impact: string;
  prior_history: string;
  notes: string;
  red_flags: string[];
}

export interface Log {
  patient_email: string;
  timestamp: string; // ISO string
  body_parts: BodyPartLog[];
  general_flag: number; // 0 = no urgent concern, 1 = needs attention
  ai_summary: string;
}

Guidelines:
- Start with a warm, empathetic summary of the user's input.
- Use prior answers and context to avoid redundant questions.
- If urgent concerns are detected, set general_flag = 1.
- Do not give diagnoses or treatment advice. If asked, reply: "I recommend you speak to your clinician about that."
- use email hrdk.biz@gmail.com for now
`


async function fetchPatientContext(email: string) {
	console.log(email)
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
	const res = await fetch(`${baseUrl}/api/record?patient_email=${encodeURIComponent(email)}`);
	if (!res.ok) return null;
	const records = await res.json();
	console.log(records)
	return records?.[0]?.context ?? null;
}

export async function POST(req: NextRequest) {
	if (!GEMINI_API_KEY) {
		console.error("Missing Gemini API key");
		return NextResponse.json({ error: "Missing Gemini API key" }, { status: 500 });
	}
	const body = await req.json();
	const { messages, patient_email } = body;
	if (!Array.isArray(messages) || !patient_email) {
		console.error("Missing messages array or patient_email", body);
		return NextResponse.json({ error: "Missing messages array or patient_email" }, { status: 400 });
	}

	let patientContext = null;
	try {
		patientContext = await fetchPatientContext(patient_email);
		if (!patientContext) console.warn('No patient context found for', patient_email, '— continuing with empty context.');
	} catch (err) {
		console.error("Error fetching patient context:", err);
	}
	const systemPromptTextWithContext = SYSTEM_PROMPT_TEXT.replace(
		/{{PATIENT_CONTEXT}}/g,
		JSON.stringify(patientContext ?? {}, null, 2)
	);
	const systemPrompt = {
		role: "user",
		parts: [{ text: systemPromptTextWithContext }],
	};

	const contents = [
		systemPrompt,
		...messages.map((m: any) => ({
			role: m.role === "user" ? "user" : "model",
			parts: [{ text: m.text }],
		}))
	];

	try {
		console.log('Sending request to Gemini...');
		const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contents }),
			}
		);
		if (!res.ok) {
			const error = await res.text();
			console.error("Gemini API error:", error);
			return NextResponse.json({ error }, { status: res.status });
		}
		const data = await res.json();		
		// Robust extraction of model response
		let modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
		console.log(modelText)
		if (!modelText) {
			modelText = data?.candidates?.[0]?.content?.text
				|| data?.candidates?.[0]?.parts?.[0]?.text
				|| "(No response)";
		}

		// Extract everything from the first '{' to the last '}' in modelText
		let jsonBlock: string | null = null;
		let firstBrace = -1;
		let lastBrace = -1;
		firstBrace = modelText.indexOf('{');
		lastBrace = modelText.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
			jsonBlock = modelText.substring(firstBrace, lastBrace + 1).trim();
			console.log('Extracted JSON substring from first to last brace (length', jsonBlock?.length ?? 0, '):');
			// Log a short preview to avoid gigantic logs
			if (jsonBlock) console.log(jsonBlock.slice(0, 2000));
		} else {
			console.warn('Could not find a JSON object bounded by braces in modelText');
		}

		let parsedObj: any = null;
		if (jsonBlock) {
			try {
				parsedObj = JSON.parse(jsonBlock);
				console.log('Parsed JSON object from model response:', parsedObj);
			} catch (err) {
				console.error("Error parsing jsonBlock as JSON:", err, '\njsonBlock:\n', jsonBlock);
			}
		} else {
			console.warn('No JSON block found in model response. modelText:', modelText.slice(0, 1000));
		}

		// Helper: validate a minimal Log shape before writing to DB
		function validateAndNormalizeLog(obj: any): any | null {
			if (!obj || typeof obj !== 'object') return null;
			const data = obj.data ?? obj; // some agents may return data at top-level
			if (!data) return null;
			// Ensure patient_email and timestamp
			if (!data.patient_email) data.patient_email = patient_email;
			if (!data.timestamp) data.timestamp = new Date().toISOString();
			// body_parts must be an array with at least one entry
			if (!Array.isArray(data.body_parts) || data.body_parts.length === 0) return null;
			// Minimal check for each body part
			for (const bp of data.body_parts) {
				if (!bp || typeof bp !== 'object') return null;
				if (!bp.body_part || (bp.intensity === undefined || bp.intensity === null)) return null;
				// coerce intensity
				if (typeof bp.intensity === 'string') {
					const n = Number(bp.intensity.replace(/[^0-9.-]+/g, ''));
					bp.intensity = Number.isFinite(n) ? n : 0;
				}
			}
			// ensure general_flag
			if (typeof data.general_flag !== 'number') data.general_flag = 0;
			if (!data.ai_summary) data.ai_summary = obj.content ?? '';
			return data;
		}

		// If model returned a completed log (type 1) send only the data object to /api/log
		if (parsedObj && parsedObj.type === 1 && parsedObj.data) {
			try {
				console.log('Sending parsedObj.data to /api/log for storage');
				const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
				const resp = await fetch(`${baseUrl}/api/log`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(parsedObj.data),
				});
				if (!resp.ok) console.error('/api/log returned non-ok status', resp.status);
				// Return only the data object in the API response as requested
				return NextResponse.json(parsedObj.data);
			} catch (err) {
				console.error("Error logging painLog to /api/log:", err);
				// If logging failed, still return the data so client can handle/retry
				return NextResponse.json(parsedObj.data);
			}
		}

		// Show everything except the JSON block we extracted
		let displayText = modelText;
		if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
			displayText = (modelText.slice(0, firstBrace) + modelText.slice(lastBrace + 1)).trim();
		}

		// Always return the content field if parsedObj exists, else fallback to displayText
		return NextResponse.json({ text: parsedObj?.content ?? displayText });
	} catch (err: any) {
		console.error("Error in chat POST handler:", err);
		return NextResponse.json({ error: String(err) }, { status: 500 });
	}
}
