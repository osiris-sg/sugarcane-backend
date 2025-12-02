import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ success: true, data: new Date().toISOString() });
}

export async function POST() {
  return NextResponse.json({ success: true, data: new Date().toISOString() });
}
