import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { telefone, codigo } = await req.json();
    if (!telefone || !codigo) return NextResponse.json({ erro: 'Telefone e código obrigatórios' }, { status: 400 });

    // Verifica OTP no website-notify
    const res = await fetch(`${API}/otp/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, codigo }),
    });
    const data = await res.json();
    if (!res.ok || !data.valido) {
      return NextResponse.json({ erro: 'Código inválido ou expirado' }, { status: 401 });
    }

    // Encontra ou cria utilizador Firebase pelo telefone
    const uid = `wa_${telefone.replace(/\D/g, '')}`;
    try {
      await adminAuth.getUser(uid);
    } catch {
      await adminAuth.createUser({
        uid,
        displayName: telefone,
        phoneNumber: `+${telefone.replace(/\D/g, '')}`,
      });
    }

    // Cria custom token para o frontend fazer login
    const customToken = await adminAuth.createCustomToken(uid, { telefone, metodo: 'whatsapp' });
    return NextResponse.json({ token: customToken });
  } catch (err) {
    console.error('OTP verify error:', err);
    return NextResponse.json({ erro: 'Erro ao verificar OTP' }, { status: 500 });
  }
}
