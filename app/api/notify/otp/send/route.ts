import { NextResponse } from 'next/server';
import { consumir, ipDoPedido } from '@/lib/rate-limit';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

// Limites: a rota é anónima e cada pedido manda uma mensagem de WhatsApp
// (custo real, e incómodo para quem recebe o código).
const LIMITE_NUMERO = { max: 3, janelaMs: 15 * 60 * 1000 };
const LIMITE_IP = { max: 15, janelaMs: 60 * 60 * 1000 };

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export async function POST(req: Request) {
  try {
    const { telefone, modo } = await req.json();
    const numero = soDigitos(telefone);
    if (numero.length < 9 || numero.length > 15) {
      return NextResponse.json({ erro: 'Telefone inválido' }, { status: 400 });
    }

    const porIp = await consumir(`otp:send:ip:${ipDoPedido(req)}`, LIMITE_IP);
    if (!porIp.ok) {
      return NextResponse.json(
        { erro: 'Demasiados pedidos. Tenta mais tarde.' },
        { status: 429, headers: { 'Retry-After': String(porIp.esperarSegundos) } },
      );
    }

    const porNumero = await consumir(`otp:send:tel:${numero}`, LIMITE_NUMERO);
    if (!porNumero.ok) {
      return NextResponse.json(
        { erro: `Já enviámos um código. Aguarda ${Math.ceil(porNumero.esperarSegundos / 60)} min para pedir outro.` },
        { status: 429, headers: { 'Retry-After': String(porNumero.esperarSegundos) } },
      );
    }

    // Login: só se envia código para números registados, mas a resposta é
    // igual nos dois casos — responder "número não registado" transformava
    // esta rota num oráculo para descobrir quem é cliente da loja.
    if (modo === 'login') {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.collection('clientes').doc(`wa_${numero}`).get();
      if (!snap.exists) return NextResponse.json({ ok: true });
    }

    const res = await fetch(`${API}/otp/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: numero }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ erro: 'Erro ao enviar OTP' }, { status: 500 });
  }
}
