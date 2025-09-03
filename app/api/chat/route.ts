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

Current Date/Time (INTERNAL):
{{CURRENT_DATE}}
(This is the current date and time. Use it when generating timestamp-related content.)

Important instructions for the assistant:
- Always reply in JSON format with these fields:
  - type: (number) 0 = guidance, 1 = pain log.
  - content: (string) a concise, empathetic user-facing message.
  - data: (object) when type === 1, include the structured Log object.
  - pdf_data: (string) when type === 1, include a markdown-formatted text that can be converted to a PDF report.
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
- If the model does not have enough information to create a complete log, ask follow-up
  questions conversationally and empathetically. Important information to gather includes:
    1) The quality/type of pain (sharp, dull, throbbing, burning, aching, stabbing, etc.)
    2) Whether the patient is taking any medication for this pain right now.
       - If yes, collect medication name, dose, and perceived effectiveness.
	   - dose should be 0 if not present else an integer representing its value in mg
    3) When the pain started and whether it's ongoing or intermittent.
    4) Any additional context that helps understand the patient's experience.
  Ask these questions naturally in conversation, not as a checklist. Show empathy 
  and acknowledge the patient's experience before asking for more details.
- Be genuinely empathetic and supportive. Acknowledge the patient's pain experience
  before requesting additional information. Use phrases like "I understand this must be 
  difficult" or "That sounds challenging" to validate their experience.
- Focus on creating a natural conversation rather than a clinical interview. 
  Gently guide the conversation to collect necessary information for structured logs.
- Avoid clinical or detached language. Use warm, conversational tone that feels 
  human and caring.
- When asking about pain types/qualities, use natural phrasing like:
  "Could you describe what the pain feels like? For example, is it sharp, dull, throbbing, burning...?"
  instead of clinical questions like "What type of pain is it?"
- Remember that patients aren't medical experts. Use simple language and help them
  describe their pain by offering examples they can relate to.
- Do not give diagnoses or treatment advice.
  If asked, reply: "I recommend you speak to your clinician about that."
- For the pdf_data field, create a comprehensive markdown report that includes:
  - Report header with patient name and ID (from context)
  - Current date and time
  - Background information about the patient (from context)
  - Detailed description of the current pain issue
  - Body parts affected with intensity ratings
  - Medication information
  - Timeline of the issue
  - Summary of findings
  - Format this as a professional medical report in markdown

Response examples:
- Type 0 (Guidance):
  {
    "type": 0,
    "content": "Thanks — could you tell me when the pain started?"
  }

- Type 1 (Pain log):
  {
    "type": 1,
    "content": "I've recorded your pain information. It sounds like you're experiencing significant discomfort in your lower back. Remember to rest and take care of yourself.",
    "data": {
      "patient_email": "patient@example.com",
      "timestamp": "2025-09-03T15:30:00Z",
      "body_parts": [
        {
          "part": "Lower back",
          "intensity": 7,
          "types": ["dull", "aching", "throbbing"],
          "notes": "Worse when sitting for long periods"
        }
      ],
      "general_flag": 0,
      "medication": {
        "taking": true,
        "name": "Ibuprofen",
        "dose": "400",
        "effectiveness": "Moderate relief"
      },
      "ai_summary": "Patient reports moderate to severe lower back pain that's dull, aching, and throbbing. Pain worsens with prolonged sitting. Taking ibuprofen with moderate relief."
    },
    "pdf_data": "# Pain Report\\n\\n**Patient:** John Doe\\n\\n**Date:** September 3, 2025\\n\\n...",
    "👁PATIENT_CONTEXT": { /* hidden context */ }
  }

Schema Definitions (summary):
- BodyPartLog: {
    body_part,
    intensity,
    types, // e.g., "sharp", "dull", "throbbing", "burning", "aching", "stabbing"
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
    ai_summary,
    pdf_data
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
	
	// Get the precise current date and time
	const now = new Date();
	const currentDate = now.toLocaleString('en-US', { 
		timeZone: 'UTC',
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	});
	
	// Add ISO timestamp for exact precision
	const isoTimestamp = now.toISOString();
	const formattedDateTime = `${currentDate} (ISO: ${isoTimestamp})`;

	const systemPromptTextWithContext = SYSTEM_PROMPT_TEXT.replace(
		/{{PATIENT_CONTEXT}}/g,
		JSON.stringify(patientContext ?? {}, null, 2)
	).replace(/{{PATIENT_EMAIL}}/g, String(patient_email))
	.replace(/{{CURRENT_DATE}}/g, formattedDateTime);
	
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
					
					// Capture pain types
					let types = bp.types ?? bp.pain_types ?? bp.painTypes ?? [];
					// If types is a string, convert to array
					if (typeof types === 'string') {
						types = types.split(/,\s*/).filter(Boolean);
					} else if (!Array.isArray(types)) {
						types = [];
					}
					
					normalizedParts.push({ 
						body_part: String(partName), 
						intensity: Number(intensity), 
						notes: String(notes),
						types: types
					});
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
				
				// add pdf_data if it exists in the response
				if (obj.pdf_data) {
					data.pdf_data = obj.pdf_data;
				} else {
					// Create a basic PDF data if none provided
					data.pdf_data = `# Pain Report\n\n**Patient Email:** ${data.patient_email}\n\n**Date:** ${new Date(data.timestamp).toLocaleString()}\n\n## Summary\n\n${data.ai_summary}\n\n## Body Parts Affected\n\n${data.body_parts.map((bp: any) => {
						let painDetails = `- **${bp.body_part}**: Pain intensity ${bp.intensity}/10`;
						// Add pain types if available
						if (bp.types && Array.isArray(bp.types) && bp.types.length > 0) {
							painDetails += ` - Type: ${bp.types.join(', ')}`;
						}
						// Add notes if available
						if (bp.notes) {
							painDetails += ` - ${bp.notes}`;
						}
						return painDetails;
					}).join('\n')}\n\n## Medication\n\n${data.medication.taking ? `Taking: ${data.medication.name || 'Medication'}\nDose: ${data.medication.dose || 'Not specified'}\nEffectiveness: ${data.medication.effectiveness || 'Not specified'}` : 'No medication reported'}`;
				}
				
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
					return NextResponse.json({ 
						text: parsedObj.content ?? 'Log saved successfully.', 
						saved: true, 
						data: normalized,
						pdf_data: normalized.pdf_data
					});
				} else {
					const errText = await resp.text();
					console.error('/api/log returned non-ok status', resp.status, errText);
					return NextResponse.json({ 
						text: parsedObj.content ? `${parsedObj.content} (save failed)` : 'Log created but saving failed.', 
						saved: false, 
						data: normalized,
						pdf_data: normalized.pdf_data 
					}, { status: 500 });
				}
			} catch (err) {
				console.error("Error logging painLog to /api/log:", err);
				return NextResponse.json({ 
					text: parsedObj.content ?? 'Log produced but saving failed due to server error.', 
					saved: false, 
					data: normalized,
					pdf_data: normalized.pdf_data 
				});
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
