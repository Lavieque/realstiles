import { NextRequest, NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';
import { sincronizarVendas } from '@/lib/vendas-server';

export const dynamic = 'force-dynamic';

// Chamado pelo admin depois de mudar o estado de uma encomenda, para manter
// o contador de vendas dos produtos em linha com o estado.
export async function POST(req: NextRequest) {
  const auth = await exigirPermissao(req, 'encomendas');
  if (auth instanceof NextResponse) return auth;

  try {
    const { encomenda_id } = await req.json();
    if (typeof encomenda_id !== 'string' || !encomenda_id) {
      return NextResponse.json({ error: 'encomenda_id em falta' }, { status: 400 });
    }
    const resultado = await sincronizarVendas(encomenda_id);
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
