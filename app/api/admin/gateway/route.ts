import { NextRequest, NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';
import {
  GATEWAYS, configuracaoGateway, eGateway, eMetodo, getConfigPagamentos,
  metodosDisponiveis, setGatewayAtivo, setMetodoAtivo,
} from '@/lib/pagamentos';

// Gateway de pagamento activo no site e métodos ligados em cada gateway
// (painel /admin/pagamentos).

async function estado() {
  const { ativo, desativados } = await getConfigPagamentos();
  return {
    ativo,
    gateways: GATEWAYS.map(g => ({
      ...g,
      ...configuracaoGateway(g.id),
      desativados: desativados[g.id],
    })),
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

// Corpo { gateway } activa o gateway no site.
// Corpo { gateway, metodo, ativo } liga/desliga um método nesse gateway.
export async function PUT(req: NextRequest) {
  const auth = await exigirPermissao(req, 'pagamentos');
  if (auth instanceof NextResponse) return auth;

  const { gateway, metodo, ativo } = await req.json().catch(() => ({}));
  if (!eGateway(gateway)) return NextResponse.json({ error: 'Gateway inválido' }, { status: 400 });

  try {
    if (metodo !== undefined) {
      if (!eMetodo(metodo) || typeof ativo !== 'boolean') {
        return NextResponse.json({ error: 'Método inválido' }, { status: 400 });
      }
      await setMetodoAtivo(gateway, metodo, ativo, auth.uid);
      return NextResponse.json(await estado());
    }

    // Não deixa activar um gateway sem nenhum método disponível: o checkout
    // ficaria sem forma de pagar.
    const { desativados } = await getConfigPagamentos();
    if (metodosDisponiveis(gateway, desativados).length === 0) {
      return NextResponse.json(
        { error: 'Este gateway não tem nenhum método configurado e ligado' },
        { status: 409 },
      );
    }

    await setGatewayAtivo(gateway, auth.uid);
    return NextResponse.json(await estado());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
