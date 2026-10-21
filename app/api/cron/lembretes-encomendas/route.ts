import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { enviarLembretesPendentes } from '@/lib/lembretes';

export const dynamic = 'force-dynamic';

// Chamado pelo cron da Vercel (vercel.json), que envia
// `Authorization: Bearer $CRON_SECRET`. Sem CRON_SECRET configurado a rota
// recusa tudo, para não ficar aberta a qualquer pedido anónimo.
function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const dado = Buffer.from(req.headers.get('authorization') || '');
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return dado.length === esperado.length && crypto.timingSafeEqual(dado, esperado);
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json(await enviarLembretesPendentes());
  } catch (err) {
    console.error('[cron] lembretes de encomendas', err);
    return NextResponse.json({ error: 'Falha ao enviar lembretes' }, { status: 500 });
  }
}
