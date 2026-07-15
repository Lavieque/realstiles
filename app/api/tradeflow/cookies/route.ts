import { NextRequest, NextResponse } from 'next/server';

const TF_URL = () => process.env.TRADEFLOW_API_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${TF_URL()}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token: process.env.COOKIE_CAPTURE_TOKEN }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
