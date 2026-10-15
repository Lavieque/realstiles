import { NextRequest, NextResponse } from 'next/server';
import { autenticar } from '@/lib/permissoes-server';
import { criarEncomendaServidor, ErroEncomenda } from '@/lib/encomendas-server';
import { consumir } from '@/lib/rate-limit';
import { notificarEncomendaCriada } from '@/lib/email';
import { adminDb } from '@/lib/firebase-admin';

// Criação de encomendas. O cliente não escreve em `encomendas` (as
// firestore.rules negam-lhe o `create`): envia o pedido aqui e o servidor
// recalcula preços, taxa de entrega e total a partir dos produtos e da
// configuração do site.
export async function POST(req: NextRequest) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  // Travão contra criação em massa de encomendas por uma conta
  const limite = await consumir(`encomendas:${caller.uid}`, { max: 20, janelaMs: 60 * 60 * 1000 });
  if (!limite.ok) {
    return NextResponse.json(
      { error: 'Demasiadas encomendas seguidas. Tenta mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    );
  }

  try {
    const body = await req.json();
    const encomenda = await criarEncomendaServidor(caller, {
      itens: body?.itens,
      morada: body?.morada,
      cidade: body?.cidade,
      telefone: body?.telefone,
      notas: body?.notas,
      pagamento_metodo: body?.pagamento_metodo,
      forma_entrega: body?.forma_entrega,
    });
    // Avisa o cliente de que falta pagar. O email não pode fazer a criação
    // falhar, por isso os erros ficam no log e a resposta segue na mesma.
    try {
      const snap = await adminDb.collection('encomendas').doc(encomenda.id).get();
      if (snap.exists) await notificarEncomendaCriada(encomenda.id, snap.data()!);
    } catch (e) {
      console.error('[encomendas] aviso de encomenda criada falhou', e);
    }

    return NextResponse.json(encomenda, { status: 201 });
  } catch (err) {
    if (err instanceof ErroEncomenda) {
      return NextResponse.json({ error: err.message }, { status: err.http });
    }
    console.error('[encomendas] erro ao criar', err);
    return NextResponse.json({ error: 'Não foi possível criar a encomenda.' }, { status: 500 });
  }
}
