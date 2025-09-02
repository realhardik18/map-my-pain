import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { password } = await request.json();
  console.log(password)  
  const isValid = password === process.env.ADMIN_PASSWORD;
  return NextResponse.json({ authed: isValid });
}
