import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/monogdb';
import { Record } from '@/models/Record';

// POST: Add a new record
export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.patient_email || !data.context) {
    return NextResponse.json({ error: 'Invalid record data' }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db();
  await db.collection('records').insertOne(data);
  return NextResponse.json({ success: true });
}

// GET: Get all records or records for a specific patient_email
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patient_email = searchParams.get('patient_email');
  const client = await clientPromise;
  const db = client.db();
  let records;
  if (patient_email) {
    records = await db.collection('records').find({ patient_email }).toArray();
  } else {
    records = await db.collection('records').find({}).toArray();
  }
  return NextResponse.json(records);
}

// PUT: Update context for a given patient_email
export async function PUT(req: NextRequest) {
  const data = await req.json();
  if (!data.patient_email || !data.context) {
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

// DELETE: Remove record for a given patient_email
export async function DELETE(req: NextRequest) {
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
