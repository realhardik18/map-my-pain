import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/monogdb';
import { Log } from '@/models/Log';

// POST: Add a new log
export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.patient_email || !data.timestamp || !Array.isArray(data.body_parts)) {
    return NextResponse.json({ error: 'Invalid log data' }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db();
  await db.collection('logs').insertOne(data);
  return NextResponse.json({ success: true });
}

// GET: Get all logs or logs for a specific patient_email
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patient_email = searchParams.get('patient_email');
  const client = await clientPromise;
  const db = client.db();
  let logs;
  if (patient_email) {
    logs = await db.collection('logs').find({ patient_email }).toArray();
  } else {
    logs = await db.collection('logs').find({}).toArray();
  }
  return NextResponse.json(logs);
}
