import { NextResponse } from 'next/server';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { telefone, modo } = await req.json();
    if (!telefone) return NextResponse.json({ erro: 'Telefone obrigatório' }, { status: 400 });

    // Para login: verifica se o número está registado antes de enviar OTP
    if (modo === 'login') {
      const { adminDb } = await import('@/lib/firebase-admin');
      const uid = `wa_${telefone.replace(/\D/g, '')}`;
      const snap = await adminDb.collection('clientes').doc(uid).get();
      if (!snap.exists) {
        return NextResponse.json({ erro: 'Número não registado. Cria uma conta primeiro.' }, { status: 403 });
      }
    }

    const res = await fetch(`${API}/otp/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ erro: 'Erro ao enviar OTP' }, { status: 500 });
  }
}
