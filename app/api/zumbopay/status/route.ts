import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { consultarPagamentoZumbo, estadoZumboPago, marcarPagamentoZumboPago } from '@/lib/zumbopay';

// Reconciliação manual (admin): consulta no ZumboPay cada tentativa de
// pagamento da encomenda e confirma-a se alguma estiver paga. Serve para
// acertar encomendas cujo webhook não chegou.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }
  const perfil = await adminDb.collection('clientes').doc(uid).get();
  if (perfil.data()?.admin !== true) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { encomenda_id } = await req.json().catch(() => ({}));
  if (!encomenda_id) return NextResponse.json({ error: 'encomenda_id em falta' }, { status: 400 });

  const snap = await adminDb.collection('pagamentos').where('encomenda_id', '==', encomenda_id).get();
  const tentativas = snap.docs
    .filter(d => d.data().referencia_zumbopay)
    .sort((a, b) => (b.data().criado_em?.toMillis?.() ?? 0) - (a.data().criado_em?.toMillis?.() ?? 0));

  const resultados = [];
  let pago = false;

  for (const pagSnap of tentativas) {
    const p = pagSnap.data();
    const reference = p.referencia_zumbopay as string;

    if (p.estado === 'pago') {
      pago = true;
      resultados.push({ reference, metodo: p.metodo, estado_local: 'pago', estado_zumbo: null });
      continue;
    }

    const consulta = await consultarPagamentoZumbo(reference);
    const zp = (consulta.body.data ?? consulta.body) as Record<string, unknown>;
    const estadoZumbo = consulta.ok
      ? String(zp.status ?? '—')
      : `erro ${consulta.status}`;

    let estadoLocal = p.estado as string;
    if (consulta.ok && estadoZumboPago(zp.status)) {
      const r = await marcarPagamentoZumboPago(pagSnap, { reference, amount: zp.amount, payload: zp });
      estadoLocal = r.ok ? 'pago' : 'montante_divergente';
      if (r.ok) pago = true;
    }

    resultados.push({ reference, metodo: p.metodo, estado_local: estadoLocal, estado_zumbo: estadoZumbo });
  }

  return NextResponse.json({ pago, tentativas: resultados });
}
