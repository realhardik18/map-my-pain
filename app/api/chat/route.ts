import { NextRequest, NextResponse } from "next/server"
import clientPromise from '@/lib/monogdb'

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT_TEXT = `
You are Map My Pain Assistant, a compassionate and structured AI companion that helps patients track, assess, and log their pain in detail.

Patient Context Variable (INTERNAL):
{{PATIENT_CONTEXT}}
(This is the patient's medical report. Use it to guide your responses; do NOT display it verbatim to the user.)

Patient Email (INTERNAL):
{{PATIENT_EMAIL}}
(This is the patient's primary email address. Use it only for internal reasoning and routing; do NOT display it to end users.)

Important instructions for the assistant:
- Always reply in JSON format with these fields:
  - type: (number) 0 = guidance, 1 = pain log.
  - content: (string) a concise, empathetic user-facing message.
  - data: (object) when type === 1, include the structured Log object.
- Include the patient context in the assistant's internal reasoning only.
  If you must include patient context or internal details in the assistant output,
  embed them under a single hidden marker key labeled "👁" (a single eye glyph) 
  inside the returned JSON — this hidden object should contain only the minimal
  items needed for server processing (for example: parts and scores) and must not
  be shown to end users.
- Keep the log body_parts entries minimal and consistent:
  each entry should contain only:
    { part: string, intensity: number, notes?: string }
- For the log-level flag, use one of three labels: "positive", "okay", or "emergency".
  The server will map these to the numeric general_flag (emergency => 1, otherwise 0).
- If the model does not have enough information to create a complete log, ask 2-3 concise follow-up
	questions only (no more). The follow-ups should include at least:
		1) Whether the patient is taking any medication for this pain right now (yes/no).
			 - If yes, collect medication.name, medication.dose, medication.effectiveness.
			 - The server will store medication.taking as a boolean.
		2) A brief onset/duration question (when did it start / is it ongoing?).
		3) A short free-text note for any additional context or clarifying detail.
	Keep follow-ups short and focused; do not branch into many sub-questions.
- Be empathetic and supportive, focus on summarizing and producing structured logs
  when enough info is present.
- Avoid repetitive questions. Use prior answers and the patient context to avoid
  asking the same thing.
- Do not give diagnoses or treatment advice.
  If asked, reply: "I recommend you speak to your clinician about that."

Response examples:
- Type 0 (Guidance):
  {
    "type": 0,
    "content": "Thanks — could you tell me when the pain started?"
  }

- Type 1 (Pain log):
  {
    "type": 1,
    "content": "Log entry created.",
    "data": { /* Log object */ },
    "👁PATIENT_CONTEXT": { /* hidden context */ }
  }

Schema Definitions (summary):
- BodyPartLog: {
    body_part,
    intensity,
    types,
    onset,
    pattern,
    triggers,
    relievers,
    associated_symptoms,
    medication,
    impact,
    prior_history,
    notes,
    red_flags
  }

- Log: {
    patient_email,
    timestamp,
    body_parts,
    general_flag,
    ai_summary
  }
`;



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
	).replace(/{{PATIENT_EMAIL}}/g, String(patient_email));
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

				// Accept either the new minimal schema (part,intensity,notes) or the older body_part field
				if (!Array.isArray(data.body_parts) || data.body_parts.length === 0) return null;

				// Normalize each body part entry to ensure the DB gets consistent keys: body_part, intensity, notes
				const normalizedParts: any[] = [];
				for (const bp of data.body_parts) {
					if (!bp || typeof bp !== 'object') return null;
					// model may send { part, intensity, notes } or { body_part, intensity, notes }
					const partName = bp.part ?? bp.body_part ?? bp.name ?? null;
					if (!partName) return null;
					let intensity = bp.intensity;
					if (intensity === undefined || intensity === null) return null;
					if (typeof intensity === 'string') {
						const n = Number(intensity.replace(/[^0-9.-]+/g, ''));
						intensity = Number.isFinite(n) ? n : 0;
					}
					const notes = bp.notes ?? bp.note ?? bp.notes_text ?? '';
					normalizedParts.push({ body_part: String(partName), intensity: Number(intensity), notes: String(notes) });
				}

				data.body_parts = normalizedParts;

				// normalize medication: accept boolean, string, or object
				if (typeof data.medication === 'boolean') {
					data.medication = { taking: data.medication, name: '', dose: '', effectiveness: '' };
				} else if (typeof data.medication === 'string') {
					const s = data.medication.toLowerCase();
					const taking = s === 'yes' || s === 'true' || s === 'y';
					data.medication = { taking, name: '', dose: '', effectiveness: '' };
				} else if (typeof data.medication === 'object' && data.medication !== null) {
					const m = data.medication;
					let taking = false;
					if (typeof m.taking === 'boolean') taking = m.taking;
					else if (typeof m.taking === 'string') {
						const s = m.taking.toLowerCase();
						taking = s === 'yes' || s === 'true' || s === 'y';
					}
					data.medication = {
						taking,
						name: (m.name ?? m.medication_name ?? '') + '',
						dose: (m.dose ?? m.medication_dose ?? '') + '',
						effectiveness: (m.effectiveness ?? m.medication_effectiveness ?? '') + '',
					};
				} else {
					data.medication = { taking: false, name: '', dose: '', effectiveness: '' };
				}

				// normalize general_flag: accept numeric or labelled string
				if (typeof data.general_flag === 'string') {
					const s = data.general_flag.toLowerCase();
					data.general_flag = s === 'emergency' ? 1 : 0;
				}
				if (typeof data.general_flag !== 'number') data.general_flag = 0;

				// ensure an assistant-generated summary / general note exists
				if (!data.ai_summary) data.ai_summary = obj.content ?? '';
				return data;
			}

		// If model returned a completed log (type 1) validate, normalize and send the data object to /api/log
		if (parsedObj && parsedObj.type === 1) {
			const normalized = validateAndNormalizeLog(parsedObj);
			if (!normalized) {
				console.error('Parsed object did not pass minimal validation', parsedObj);
				return NextResponse.json({ text: parsedObj?.content ?? 'Model produced an invalid log.', saved: false, data: parsedObj?.data ?? null }, { status: 422 });
			}
			try {
				console.log('Sending normalized log to /api/log for storage');
				const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
				const resp = await fetch(`${baseUrl}/api/log`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(normalized),
				});
				if (resp.ok) {
					// Return a clear confirmation message for the client chat UI
					return NextResponse.json({ text: parsedObj.content ?? 'Log saved successfully.', saved: true, data: normalized });
				} else {
					const errText = await resp.text();
					console.error('/api/log returned non-ok status', resp.status, errText);
					return NextResponse.json({ text: parsedObj.content ? `${parsedObj.content} (save failed)` : 'Log created but saving failed.', saved: false, data: normalized }, { status: 500 });
				}
			} catch (err) {
				console.error("Error logging painLog to /api/log:", err);
				return NextResponse.json({ text: parsedObj.content ?? 'Log produced but saving failed due to server error.', saved: false, data: normalized });
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
