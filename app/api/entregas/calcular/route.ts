import { NextRequest, NextResponse } from 'next/server';
import { ErroEncomenda, estimarEntrega } from '@/lib/encomendas-server';
import { consumir, ipDoPedido } from '@/lib/rate-limit';

// Estimativa da entrega para o checkout. Usa a mesma função que fixa a taxa
// ao criar a encomenda (preços e pesos lidos dos produtos, tarifas de
// config/entregas), por isso o valor mostrado é o valor cobrado. Não cria nada.
export async function POST(req: NextRequest) {
  const limite = await consumir(`entregas-calcular:${ipDoPedido(req)}`, { max: 240, janelaMs: 60 * 60 * 1000 });
  if (!limite.ok) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(limite.esperarSegundos) } },
    );
  }

  try {
    const body = await req.json();
    const r = await estimarEntrega(body?.itens, {
      forma_entrega: body?.forma_entrega,
      provincia: body?.provincia,
      zona: body?.zona,
    });
    return NextResponse.json(r);
  } catch (err) {
    if (err instanceof ErroEncomenda) {
      return NextResponse.json({ error: err.message }, { status: err.http });
    }
    console.error('[entregas/calcular]', err);
    return NextResponse.json({ error: 'Não foi possível calcular a entrega.' }, { status: 500 });
  }
}
