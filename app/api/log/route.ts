import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requireUser, resolvePatientEmail } from '@/lib/auth';

// POST: Add a new log for the signed-in patient
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser('patient');
  if (error) return error;

  const data = await req.json();
  if (!data.timestamp || !Array.isArray(data.body_parts)) {
    return NextResponse.json({ error: 'Invalid log data' }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db();
  await db.collection('logs').insertOne({ ...data, patient_email: user.email });
  return NextResponse.json({ success: true });
}

// GET: Admins get all logs (or one patient's); patients only get their own. Oldest first.
export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const patient_email = resolvePatientEmail(user, searchParams.get('patient_email'));
  const client = await clientPromise;
  const db = client.db();
  const logs = await db
    .collection('logs')
    .find(patient_email ? { patient_email } : {})
    .sort({ timestamp: 1 })
    .toArray();
  return NextResponse.json(logs);
}
