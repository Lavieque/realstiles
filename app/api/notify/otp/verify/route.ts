import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { consumir, libertar, ipDoPedido } from '@/lib/rate-limit';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

// Um código acertado devolve um custom token do Firebase, ou seja sessão
// completa na conta: sem limite de tentativas, um código curto cai à força
// bruta em poucos milhares de pedidos.
const LIMITE_NUMERO = { max: 5, janelaMs: 15 * 60 * 1000 };
const LIMITE_IP = { max: 30, janelaMs: 60 * 60 * 1000 };

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export async function POST(req: Request) {
  try {
    const { telefone, codigo, nome } = await req.json();
    const numero = soDigitos(telefone);
    if (!numero || !codigo) return NextResponse.json({ erro: 'Telefone e código obrigatórios' }, { status: 400 });
    const isRegistar = typeof nome === 'string' && nome.trim().length > 0;

    const chaveNumero = `otp:verify:tel:${numero}`;

    const porIp = await consumir(`otp:verify:ip:${ipDoPedido(req)}`, LIMITE_IP);
    if (!porIp.ok) {
      return NextResponse.json(
        { erro: 'Demasiadas tentativas. Tenta mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(porIp.esperarSegundos) } },
      );
    }

    const porNumero = await consumir(chaveNumero, LIMITE_NUMERO);
    if (!porNumero.ok) {
      return NextResponse.json(
        { erro: `Demasiadas tentativas. Pede um código novo dentro de ${Math.ceil(porNumero.esperarSegundos / 60)} min.` },
        { status: 429, headers: { 'Retry-After': String(porNumero.esperarSegundos) } },
      );
    }

    // Verifica OTP no website-notify
    const res = await fetch(`${API}/otp/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: numero, codigo }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return NextResponse.json({ erro: 'Código inválido ou expirado' }, { status: 401 });
    }

    // Código certo: as tentativas falhadas deixam de contar
    await libertar(chaveNumero);

    const uid = `wa_${numero}`;
    const { adminDb } = await import('@/lib/firebase-admin');
    const perfilSnap = await adminDb.collection('clientes').doc(uid).get();

    if (isRegistar) {
      // Registo: bloqueia se já existe
      if (perfilSnap.exists) {
        return NextResponse.json({ erro: 'Este número já tem conta. Faz login.' }, { status: 409 });
      }
      // Cria perfil em Firestore. `telefone_verificado` é escrito só aqui,
      // depois do OTP acertar, e é o único campo em que as rotas de WhatsApp
      // confiam — `telefone` é editável pelo cliente no perfil e por isso não
      // prova posse do número (ver app/api/notify/messages/send).
      await adminDb.collection('clientes').doc(uid).set({
        nome: nome.trim(),
        email: '',
        telefone: numero,
        telefone_verificado: numero,
        morada: '',
        admin: false,
        notif_canal: 'whatsapp',
        criado_em: new Date(),
      });
    } else {
      // Login: bloqueia se não existe
      if (!perfilSnap.exists) {
        return NextResponse.json({ erro: 'Número não registado. Cria uma conta primeiro.' }, { status: 403 });
      }
      // Contas criadas antes de `telefone_verificado` existir ficam com o
      // campo preenchido no primeiro login por OTP
      if (perfilSnap.data()?.telefone_verificado !== numero) {
        await adminDb.collection('clientes').doc(uid).update({ telefone_verificado: numero });
      }
    }

    // Garante que o utilizador existe no Firebase Auth
    try {
      await adminAuth.getUser(uid);
    } catch {
      await adminAuth.createUser({
        uid,
        displayName: isRegistar ? nome.trim() : (perfilSnap.data()?.nome || numero),
        phoneNumber: `+${numero}`,
      });
    }

    // Cria custom token para o frontend fazer login
    const customToken = await adminAuth.createCustomToken(uid, { telefone: numero, metodo: 'whatsapp' });
    return NextResponse.json({ token: customToken });
  } catch (err) {
    console.error('OTP verify error:', err);
    return NextResponse.json({ erro: 'Erro ao verificar OTP' }, { status: 500 });
  }
}
