import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { consumir, ipDoPedido } from '@/lib/rate-limit';
import { paraMs } from '@/lib/promocao';

export const dynamic = 'force-dynamic';

const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

// Acompanhamento sem conta: referência (ENC + 4 letras do ID + nº sequencial)
// e telemóvel da encomenda. A referência é curta e adivinhável, por isso o
// telemóvel é um segundo factor e o pedido tem limite por IP. Só devolve o
// estado — nunca morada, email, telemóvel nem valores.
export async function POST(req: NextRequest) {
  const limite = await consumir(`acompanhar:${ipDoPedido(req)}`, { max: 15, janelaMs: 10 * 60 * 1000 });
  if (!limite.ok) {
    return NextResponse.json(
      { error: 'Demasiadas tentativas. Tenta novamente daqui a pouco.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    );
  }

  let referencia = '';
  let telefone = '';
  try {
    const body = await req.json();
    referencia = String(body?.referencia ?? '').trim().toUpperCase().replace(/\s+/g, '');
    telefone = digitos(body?.telefone);
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  }

  const naoEncontrada = NextResponse.json(
    { error: 'Não encontrámos uma encomenda com estes dados. Confirma a referência e o telemóvel usado na compra.' },
    { status: 404 },
  );

  // Formato novo: ENC + 4 caracteres do ID + número sequencial
  const m = /^ENC([A-Z0-9]{4})(\d{1,9})$/.exec(referencia);
  if (!m || telefone.length < 8) return naoEncontrada;
  const [, prefixo, numero] = m;

  try {
    const snap = await adminDb.collection('encomendas')
      .where('numero_sequencial', '==', Number(numero))
      .limit(5)
      .get();
    const doc = snap.docs.find(d => d.id.substring(0, 4).toUpperCase() === prefixo);
    if (!doc) return naoEncontrada;

    const enc = doc.data();
    // Compara os 9 últimos dígitos (ignora indicativo +258 e espaços)
    const guardado = digitos(enc.telefone_contacto);
    if (guardado.slice(-9) !== telefone.slice(-9)) return naoEncontrada;

    const historico = ((enc.historico_estados || []) as { estado: string; data: unknown }[])
      .map(h => ({ estado: h.estado, data: paraMs(h.data) }));

    return NextResponse.json({
      referencia,
      estado: enc.estado,
      pagamento_estado: enc.pagamento_estado ?? null,
      forma_entrega: enc.forma_entrega ?? null,
      criado_em: paraMs(enc.criado_em),
      actualizado_em: paraMs(enc.actualizado_em),
      historico,
      itens: ((enc.itens || []) as { nome: string; imagem?: string; quantidade: number }[])
        .map(i => ({ nome: i.nome, imagem: i.imagem || '', quantidade: i.quantidade })),
    });
  } catch (err) {
    console.error('[acompanhar]', err);
    return NextResponse.json({ error: 'Erro ao consultar a encomenda' }, { status: 500 });
  }
}
