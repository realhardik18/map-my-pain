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
  general_flag: number;
  ai_summary: string;
}
