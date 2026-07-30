import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { telefone, codigo, nome } = await req.json();
    if (!telefone || !codigo) return NextResponse.json({ erro: 'Telefone e código obrigatórios' }, { status: 400 });
    const isRegistar = typeof nome === 'string' && nome.trim().length > 0;

    // Verifica OTP no website-notify
    const res = await fetch(`${API}/otp/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, codigo }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return NextResponse.json({ erro: 'Código inválido ou expirado' }, { status: 401 });
    }

    const uid = `wa_${telefone.replace(/\D/g, '')}`;
    const { adminDb } = await import('@/lib/firebase-admin');
    const perfilSnap = await adminDb.collection('clientes').doc(uid).get();

    if (isRegistar) {
      // Registo: bloqueia se já existe
      if (perfilSnap.exists) {
        return NextResponse.json({ erro: 'Este número já tem conta. Faz login.' }, { status: 409 });
      }
      // Cria perfil em Firestore
      await adminDb.collection('clientes').doc(uid).set({
        nome: nome.trim(),
        email: '',
        telefone,
        morada: '',
        admin: false,
        criado_em: new Date(),
      });
    } else {
      // Login: bloqueia se não existe
      if (!perfilSnap.exists) {
        return NextResponse.json({ erro: 'Número não registado. Cria uma conta primeiro.' }, { status: 403 });
      }
    }

    // Garante que o utilizador existe no Firebase Auth
    try {
      await adminAuth.getUser(uid);
    } catch {
      await adminAuth.createUser({
        uid,
        displayName: isRegistar ? nome.trim() : (perfilSnap.data()?.nome || telefone),
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
