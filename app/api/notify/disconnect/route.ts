import { NextResponse } from 'next/server';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function POST() {
  try {
    const res = await fetch(`${API}/status/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, erro: 'API indisponível' }, { status: 503 });
  }
}
