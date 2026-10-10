import { NextRequest, NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';
import {
  GATEWAYS, METODOS, configuracaoGateway, eGateway, eMetodo, gatewaySuporta,
  getConfigPagamentos, metodosConfigurados, metodosDisponiveis, setConfigMetodo,
} from '@/lib/pagamentos';

// Gateway e interruptor de cada método de pagamento (painel /admin/pagamentos).

async function estado() {
  const cfg = await getConfigPagamentos();
  const disponiveis = metodosDisponiveis(cfg);
  return {
    metodos: Object.fromEntries(METODOS.map(m => [m, {
      ...cfg[m],
      disponivel: disponiveis.includes(m),
      // Gateways que suportam o método e o têm configurado no servidor
      gateways: GATEWAYS.filter(g => gatewaySuporta(g.id, m)).map(g => ({
        id: g.id,
        configurado: metodosConfigurados(g.id).includes(m),
      })),
    }])),
    gateways: GATEWAYS.map(g => ({ ...g, ...configuracaoGateway(g.id) })),
  };
}

export async function GET(req: NextRequest) {
  const auth = await exigirPermissao(req, 'pagamentos');
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await estado());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Corpo { metodo, gateway?, ativo? }: muda o gateway e/ou liga/desliga o método.
export async function PUT(req: NextRequest) {
  const auth = await exigirPermissao(req, 'pagamentos');
  if (auth instanceof NextResponse) return auth;

  const { metodo, gateway, ativo } = await req.json().catch(() => ({}));
  if (!eMetodo(metodo)) return NextResponse.json({ error: 'Método inválido' }, { status: 400 });
  if (gateway !== undefined) {
    if (!eGateway(gateway) || !gatewaySuporta(gateway, metodo)) {
      return NextResponse.json({ error: 'Este gateway não suporta este método' }, { status: 400 });
    }
    if (!metodosConfigurados(gateway).includes(metodo)) {
      return NextResponse.json({ error: 'O gateway escolhido não tem carteira configurada para este método' }, { status: 409 });
    }
  }
  if (ativo !== undefined && typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
  }

  try {
    await setConfigMetodo(metodo, {
      ...(gateway !== undefined ? { gateway } : {}),
      ...(ativo !== undefined ? { ativo } : {}),
    }, auth.uid);
    return NextResponse.json(await estado());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
