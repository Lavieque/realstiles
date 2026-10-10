import { NextRequest, NextResponse } from 'next/server';
import { autenticar, encomendaDoCaller } from '@/lib/permissoes-server';
import { getConfigPagamentos, metodosDisponiveis, METODOS } from '@/lib/pagamentos';
import type { MetodoPagamento, PedidoPagamento, ResultadoPagamento } from '@/lib/pagamentos';
import { iniciarCobrancaZumbo, criarCheckoutZumbo } from '@/lib/zumbopay';
import { iniciarCobrancaClicpay, criarCheckoutClicpay } from '@/lib/clicpay';

// A ClicPay só responde a /c2b depois de o cliente introduzir o PIN (~60s
// no pior caso): a função precisa de mais tempo do que o habitual.
export const maxDuration = 120;

// Inicia o pagamento de uma encomenda no gateway activo (escolhido no admin).
// M-Pesa/e-Mola: pedido de confirmação no telemóvel → status "pending" (ou
// "succeeded" se confirmar logo). Cartão: devolve status "redirect" com o
// checkout_url para onde o cliente deve ser enviado.
export async function POST(req: NextRequest) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  try {
    const { encomenda_id, msisdn, metodo, customer_name } = await req.json();
    if (!encomenda_id || !METODOS.includes(metodo)) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }
    if (metodo !== 'cartao' && !msisdn) {
      return NextResponse.json({ error: 'Número de telefone em falta' }, { status: 400 });
    }

    // Só se paga uma encomenda própria, e sempre pelo total guardado nela
    const encomenda = await encomendaDoCaller(caller, String(encomenda_id));
    if (!encomenda) return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 });
    if (encomenda.pagamento_estado === 'pago') {
      return NextResponse.json({ error: 'Esta encomenda já está paga' }, { status: 409 });
    }
    const amount = Number(encomenda.total);
    if (!(amount > 0)) return NextResponse.json({ error: 'Total da encomenda inválido' }, { status: 400 });

    const { ativo: gateway, desativados } = await getConfigPagamentos();
    if (!metodosDisponiveis(gateway, desativados).includes(metodo)) {
      return NextResponse.json({ error: 'Método de pagamento indisponível de momento' }, { status: 503 });
    }

    const pedido: PedidoPagamento = {
      encomendaId: String(encomenda_id),
      amount,
      metodo: metodo as MetodoPagamento,
      msisdn: typeof msisdn === 'string' ? msisdn : undefined,
      customerName: customer_name,
      customerEmail: encomenda.cliente_email || caller.email || undefined,
    };

    let resultado: ResultadoPagamento;
    if (gateway === 'clicpay') {
      resultado = metodo === 'cartao' ? await criarCheckoutClicpay(pedido) : await iniciarCobrancaClicpay(pedido);
    } else {
      resultado = metodo === 'cartao' ? await criarCheckoutZumbo(pedido) : await iniciarCobrancaZumbo(pedido);
    }

    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.http });
    return NextResponse.json({
      gateway,
      pagamento_id: resultado.pagamento_id,
      reference: resultado.reference,
      status: resultado.status,
      ...(resultado.status === 'redirect' ? { checkout_url: resultado.checkout_url } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
