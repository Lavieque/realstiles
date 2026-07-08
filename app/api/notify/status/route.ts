import { NextResponse } from 'next/server';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function GET() {
  try {
    const res = await fetch(`${API}/status`, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'desligado', qr: null, numero: null, mensagens_hoje: 0 });
  }
}
