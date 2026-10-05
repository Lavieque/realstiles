import { NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'integracoes');
  if (auth instanceof NextResponse) return auth;

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
