export interface BodyPart {
  body_part: string;
  intensity: number;
  notes: string;
}

export interface Medication {
  taking: boolean;
  name: string;
  dose: string | number;
  effectiveness: string;
}

export interface Log {
  _id: string;
  patient_email: string;
  timestamp: string;
  body_parts: BodyPart[];
  general_flag: number;
  ai_summary: string;
  pdf_data: string;
  medication: Medication;
}
