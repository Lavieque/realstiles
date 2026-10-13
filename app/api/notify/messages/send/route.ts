import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { autenticar, type Caller } from '@/lib/permissoes-server';
import { consumir } from '@/lib/rate-limit';

const API = process.env.NOTIFY_API_URL || 'http://localhost:3010';
const KEY = process.env.NOTIFY_API_KEY || '';

// Só dígitos, sem o indicativo 258, para comparar números escritos de formas diferentes
const normalizar = (tel: string) => String(tel).replace(/\D/g, '').replace(/^258/, '');

// Números cuja posse o caller provou: o do uid (login por WhatsApp) e o
// `telefone_verificado`, escrito pelo servidor em /api/notify/otp/verify.
//
// O campo `telefone` do perfil NÃO entra aqui: o cliente escreve-o sozinho
// (lib/auth.ts, actualizarPerfil), pelo que bastava gravar o número de outra
// pessoa para o WhatsApp da loja lhe enviar o texto que o atacante quisesse.
async function telefonesDoCaller(caller: Caller): Promise<string[]> {
  const tels: string[] = [];
  if (caller.uid.startsWith('wa_')) tels.push(caller.uid.slice(3));
  const verificado = (await adminDb.collection('clientes').doc(caller.uid).get()).data()?.telefone_verificado;
  if (verificado) tels.push(String(verificado));
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

    if (!staff) {
      const limite = await consumir(`wa:send:${caller.uid}`, { max: 10, janelaMs: 60 * 60 * 1000 });
      if (!limite.ok) {
        return NextResponse.json(
          { erro: 'Demasiadas mensagens. Tenta mais tarde.' },
          { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
        );
      }
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
