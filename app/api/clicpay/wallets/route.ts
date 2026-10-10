import { NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';
import { listarCarteirasClicpay } from '@/lib/clicpay';

export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'pagamentos');
  if (auth instanceof NextResponse) return auth;

  if (!process.env.CLICPAY_API_TOKEN) {
    return NextResponse.json({ error: 'CLICPAY_API_TOKEN não configurado' }, { status: 503 });
  }

  try {
    const { ok, status, body } = await listarCarteirasClicpay();
    if (!ok) {
      return NextResponse.json(
        { error: typeof body.message === 'string' ? body.message : 'Erro ao obter carteiras' },
        { status },
      );
    }
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
