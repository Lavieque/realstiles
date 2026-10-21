import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { exigirPermissao } from '@/lib/permissoes-server';
import { consultarVisitas, ErroCloudflare } from '@/lib/cloudflare-analytics';

export const dynamic = 'force-dynamic';

const PERIODOS = [7, 30];

// Encomendas criadas e pagas no período, para a taxa de conversão. Filtra só
// por `criado_em`: juntar `pagamento_estado` pediria um índice composto.
async function contarEncomendas(dias: number) {
  const desde = Timestamp.fromMillis(Date.now() - dias * 24 * 60 * 60 * 1000);
  const snap = await adminDb.collection('encomendas')
    .where('criado_em', '>=', desde)
    .select('pagamento_estado')
    .get();
  return {
    criadas: snap.size,
    pagas: snap.docs.filter(d => d.data().pagamento_estado === 'pago').length,
  };
}

// Visitas (Cloudflare Web Analytics) mais as encomendas do mesmo período.
export async function GET(req: NextRequest) {
  const auth = await exigirPermissao(req, 'dashboard');
  if (auth instanceof NextResponse) return auth;

  const pedido = Number(req.nextUrl.searchParams.get('dias'));
  const dias = PERIODOS.includes(pedido) ? pedido : 7;

  try {
    const [visitas, encomendas] = await Promise.all([consultarVisitas(dias), contarEncomendas(dias)]);
    return NextResponse.json({ dias, ...visitas, encomendas });
  } catch (err) {
    if (err instanceof ErroCloudflare) {
      console.error('[visitas]', err.message);
      return NextResponse.json({ error: err.message }, { status: err.http });
    }
    console.error('[visitas] erro', err);
    return NextResponse.json({ error: 'Não foi possível carregar as visitas.' }, { status: 500 });
  }
}
