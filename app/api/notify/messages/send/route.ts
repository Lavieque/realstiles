import { NextResponse } from 'next/server';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { telefone, mensagem } = await req.json();
    if (!telefone || !mensagem) return NextResponse.json({ erro: 'telefone e mensagem obrigatórios' }, { status: 400 });

    const res = await fetch(`${API}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, mensagem }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ erro: 'Erro ao enviar mensagem WhatsApp' }, { status: 500 });
  }
}
