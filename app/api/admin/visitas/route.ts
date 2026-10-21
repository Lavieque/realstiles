import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { exigirPermissao } from '@/lib/permissoes-server';
import { consultarVisitas, inicioDoPeriodo, ErroCloudflare, type Periodo } from '@/lib/cloudflare-analytics';

export const dynamic = 'force-dynamic';


// Encomendas criadas e pagas no período, para a taxa de conversão. Filtra só
// por `criado_em`: juntar `pagamento_estado` pediria um índice composto.
async function contarEncomendas(periodo: Periodo) {
  const desde = Timestamp.fromDate(inicioDoPeriodo(periodo));
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

  const pedido = req.nextUrl.searchParams.get('periodo');
  const periodo: Periodo = pedido === 'hoje' ? 'hoje' : pedido === '30' ? 30 : 7;

  try {
    const [visitas, encomendas] = await Promise.all([consultarVisitas(periodo), contarEncomendas(periodo)]);
    return NextResponse.json({ periodo, ...visitas, encomendas });
  } catch (err) {
    if (err instanceof ErroCloudflare) {
      console.error('[visitas]', err.message);
      return NextResponse.json({ error: err.message }, { status: err.http });
    }
    console.error('[visitas] erro', err);
    return NextResponse.json({ error: 'Não foi possível carregar as visitas.' }, { status: 500 });
  }
}
