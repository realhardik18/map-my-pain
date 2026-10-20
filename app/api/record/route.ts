import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashPassword, requireUser, resolvePatientEmail } from '@/lib/auth';
import type { Record as RecordType } from '@/models/Record';

const DEFAULT_PATIENT_PASSWORD = 'patient123';

// POST (admin): Add a new patient record and create their login if it doesn't exist yet
export async function POST(req: NextRequest) {
  const { error } = await requireUser('admin');
  if (error) return error;

  const data = await req.json();
  // allow empty string for context (admins may create patient with empty context)
  if (!data.patient_email || typeof data.context === 'undefined' || data.context === null) {
    return NextResponse.json({ error: 'Invalid record data' }, { status: 400 });
  }
  const patient_email = String(data.patient_email).trim().toLowerCase();
  const client = await clientPromise;
  const db = client.db();

  if (await db.collection('records').findOne({ patient_email })) {
    return NextResponse.json({ error: 'A patient with this email already exists' }, { status: 409 });
  }
  await db.collection('records').insertOne({ patient_email, context: data.context } as RecordType);

  const password = data.password ? String(data.password) : DEFAULT_PATIENT_PASSWORD;
  await db.collection('users').updateOne(
    { email: patient_email },
    {
      $setOnInsert: {
        email: patient_email,
        name: data.name ? String(data.name) : patient_email.split('@')[0],
        role: 'patient',
        passwordHash: hashPassword(password),
      },
    },
    { upsert: true },
  );
  return NextResponse.json({ success: true, login: { email: patient_email, password } });
}

// GET: Admins get all records (or one patient's); patients only get their own
export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const patient_email = resolvePatientEmail(user, searchParams.get('patient_email'));
  const client = await clientPromise;
  const db = client.db();
  const records = await db.collection('records').find(patient_email ? { patient_email } : {}).toArray();
  return NextResponse.json(records);
}

// PUT (admin): Update context for a given patient_email
export async function PUT(req: NextRequest) {
  const { error } = await requireUser('admin');
  if (error) return error;

  const data = await req.json();
  // allow empty string context updates
  if (!data.patient_email || typeof data.context === 'undefined' || data.context === null) {
    return NextResponse.json({ error: 'Invalid update data' }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db();
  const result = await db.collection('records').updateOne(
    { patient_email: data.patient_email },
    { $set: { context: data.context } }
  );
  return NextResponse.json({ success: result.modifiedCount > 0 });
}

// DELETE (admin): Remove record for a given patient_email
export async function DELETE(req: NextRequest) {
  const { error } = await requireUser('admin');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const patient_email = searchParams.get('patient_email');
  if (!patient_email) {
    return NextResponse.json({ error: 'Missing patient_email' }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db();
  const result = await db.collection('records').deleteOne({ patient_email });
  return NextResponse.json({ success: result.deletedCount > 0 });
}
