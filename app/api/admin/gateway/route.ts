import { NextRequest, NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';
import { GATEWAYS, configuracaoGateway, eGateway, getGatewayAtivo, metodosDisponiveis, setGatewayAtivo } from '@/lib/pagamentos';

// Gateway de pagamento activo no site (painel /admin/pagamentos).

export async function GET(req: NextRequest) {
  const auth = await exigirPermissao(req, 'pagamentos');
  if (auth instanceof NextResponse) return auth;

  try {
    const ativo = await getGatewayAtivo();
    return NextResponse.json({
      ativo,
      gateways: GATEWAYS.map(g => ({ ...g, ...configuracaoGateway(g.id) })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await exigirPermissao(req, 'pagamentos');
  if (auth instanceof NextResponse) return auth;

  const { gateway } = await req.json().catch(() => ({}));
  if (!eGateway(gateway)) return NextResponse.json({ error: 'Gateway inválido' }, { status: 400 });

  // Não deixa activar um gateway sem nenhum método configurado: o checkout
  // ficaria sem forma de pagar.
  if (metodosDisponiveis(gateway).length === 0) {
    return NextResponse.json(
      { error: 'Este gateway não tem credenciais ou carteiras configuradas no servidor' },
      { status: 409 },
    );
  }

  try {
    await setGatewayAtivo(gateway, auth.uid);
    return NextResponse.json({ ativo: gateway });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
