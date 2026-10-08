import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { autenticar, type Caller } from '@/lib/permissoes-server';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

// Só dígitos, sem o indicativo 258, para comparar números escritos de formas diferentes
const normalizar = (tel: string) => String(tel).replace(/\D/g, '').replace(/^258/, '');

// Números do próprio caller: o do uid (login por WhatsApp) e o do perfil
async function telefonesDoCaller(caller: Caller): Promise<string[]> {
  const tels: string[] = [];
  if (caller.uid.startsWith('wa_')) tels.push(caller.uid.slice(3));
  const tel = (await adminDb.collection('clientes').doc(caller.uid).get()).data()?.telefone;
  if (tel) tels.push(tel);
  return tels.map(normalizar).filter(Boolean);
}

export async function POST(req: Request) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  try {
    const { telefone, mensagem } = await req.json();
    if (!telefone || !mensagem) return NextResponse.json({ erro: 'telefone e mensagem obrigatórios' }, { status: 400 });

    // Clientes só podem enviar para o próprio número; quem gere encomendas ou
    // reclamações responde a qualquer cliente
    const staff = caller.permissoes.has('encomendas') || caller.permissoes.has('reclamacoes');
    if (!staff && !(await telefonesDoCaller(caller)).includes(normalizar(telefone))) {
      return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
    }

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
