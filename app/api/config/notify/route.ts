import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { exigirPermissao } from '@/lib/permissoes-server';

export const dynamic = 'force-dynamic';

// O plano TradeFlow da loja inclui WhatsApp? Lido aqui no servidor para a
// página pública /conta não precisar de /api/tradeflow/conta (só admin).
async function whatsappAtivoNoPlano(): Promise<boolean> {
  const tfUrl = process.env.TRADEFLOW_API_URL || 'http://localhost:3000';
  try {
    const snap = await adminDb.collection('configuracoes').doc('tradeflow').get();
    const accountId = snap.data()?.account_id;
    if (!accountId) return false;
    const res = await fetch(`${tfUrl}/admin/accounts/${accountId}`, {
      headers: { 'x-admin-token': process.env.TRADEFLOW_ADMIN_TOKEN || '' },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const conta = await res.json();
    return conta?.whatsapp_ativo === true;
  } catch {
    return false;
  }
}

// Público: a página /conta usa-o para decidir se mostra o login por WhatsApp.
export async function GET() {
  try {
    const snap = await adminDb.collection('config').doc('notify').get();
    const data = snap.exists ? snap.data() : {};
    const whatsapp_login = data?.whatsapp_login ?? false;
    const whatsapp_ativo = whatsapp_login === true && await whatsappAtivoNoPlano();
    return NextResponse.json({ whatsapp_login, whatsapp_ativo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await exigirPermissao(req, 'integracoes');
  if (auth instanceof NextResponse) return auth;

  try {
    const { whatsapp_login } = await req.json();
    if (typeof whatsapp_login !== 'boolean') {
      return NextResponse.json({ error: 'whatsapp_login tem de ser booleano' }, { status: 400 });
    }
    await adminDb.collection('config').doc('notify').set({ whatsapp_login }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
