import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { referenciaEncomenda } from './referencia';
import { lembrarPagamentoPorEmail, configEmail } from './email';

// Lembretes de pagamento para encomendas `pendente` por pagar. Corre a partir
// de um cron diário (app/api/cron/lembretes-encomendas). Cada encomenda recebe
// no máximo MAX_LEMBRETES avisos, espaçados segundo ESPERAS_MS, e deixa de ser
// lembrada passados LIMITE_IDADE_MS desde a criação.
//
// O canal segue `notif_canal`, o mesmo que decide os restantes avisos: email
// para quem o escolheu, WhatsApp para os outros.

const HORA = 60 * 60 * 1000;
// Espera antes de cada lembrete: o 1.º conta desde a criação da encomenda, os
// seguintes desde o lembrete anterior.
export const ESPERAS_MS = [24 * HORA, 48 * HORA, 72 * HORA];
export const MAX_LEMBRETES = ESPERAS_MS.length;
// O cron é diário, por isso cada lembrete pode atrasar até um dia; a folga
// evita que o 3.º fique de fora.
export const LIMITE_IDADE_MS = 10 * 24 * HORA;

const soDigitos = (tel: string) => String(tel).replace(/\D/g, '');

// Mesmo critério do painel admin: no login por WhatsApp o uid é `wa_<número>`;
// caso contrário, o telefone de contacto da encomenda.
function telefoneDaEncomenda(enc: Record<string, unknown>): string {
  const cliente = String(enc.cliente_id || '');
  return cliente.startsWith('wa_')
    ? soDigitos(cliente.slice(3))
    : soDigitos(String(enc.telefone_contacto || ''));
}

async function lembrarPorWhatsApp(encomendaId: string, enc: Record<string, unknown>): Promise<boolean> {
  const telefone = telefoneDaEncomenda(enc);
  const key = process.env.NOTIFY_API_KEY;
  if (!telefone || !key) return false;

  const ref = referenciaEncomenda({
    id: encomendaId,
    numero_sequencial: Number(enc.numero_sequencial) || undefined,
  });
  const total = Number(enc.total) || 0;
  const { LOJA_URL } = configEmail();
  const mensagem = `⏰ *Encomenda ${ref}*\n\nA tua encomenda de ${total.toFixed(2)} MZN ainda não está paga. Só a preparamos depois de recebermos o pagamento.\n\nPagar agora: ${LOJA_URL.replace(/^https?:\/\//, '')}/encomenda/${encomendaId}`;

  try {
    const res = await fetch(`${process.env.NOTIFY_API_URL || 'http://localhost:3010'}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, mensagem }),
    });
    return res.ok;
  } catch (e) {
    console.error('[lembretes] whatsapp', ref, e);
    return false;
  }
}

type Marca = { toMillis?: () => number } | undefined;

// Esta encomenda deve receber um lembrete agora?
function devido(enc: Record<string, unknown>, agora: number): boolean {
  if (enc.estado !== 'pendente' || enc.pagamento_estado === 'pago') return false;
  const enviados = Number(enc.lembretes_enviados) || 0;
  if (enviados >= MAX_LEMBRETES) return false;

  const criado = (enc.criado_em as Marca)?.toMillis?.();
  if (!criado || agora - criado > LIMITE_IDADE_MS) return false;

  const ultimo = (enc.ultimo_lembrete_em as Marca)?.toMillis?.();
  const desde = enviados === 0 || !ultimo ? criado : ultimo;
  return agora - desde >= ESPERAS_MS[enviados];
}

export interface ResumoLembretes {
  analisadas: number;
  enviados: number;
  falhados: number;
}

export async function enviarLembretesPendentes(agora = Date.now()): Promise<ResumoLembretes> {
  // Filtro só por `estado`: juntar o intervalo de datas pedia um índice
  // composto, e as pendentes são poucas.
  const snap = await adminDb.collection('encomendas').where('estado', '==', 'pendente').get();
  const resumo: ResumoLembretes = { analisadas: snap.size, enviados: 0, falhados: 0 };

  for (const doc of snap.docs) {
    if (!devido(doc.data(), agora)) continue;

    // Reserva o lembrete antes de enviar: se duas execuções se sobrepuserem, a
    // segunda vê o contador já incrementado e salta. O custo é perder um
    // lembrete se o envio falhar, o que é preferível a avisar duas vezes.
    const reservado = await adminDb.runTransaction(async (tx) => {
      const actual = (await tx.get(doc.ref)).data();
      if (!actual || !devido(actual, agora)) return false;
      tx.update(doc.ref, {
        lembretes_enviados: (Number(actual.lembretes_enviados) || 0) + 1,
        ultimo_lembrete_em: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!reservado) continue;

    const enc = doc.data();
    const ok = enc.notif_canal === 'whatsapp'
      ? await lembrarPorWhatsApp(doc.id, enc)
      : await lembrarPagamentoPorEmail(doc.id, enc);
    if (ok) resumo.enviados++; else resumo.falhados++;
  }

  return resumo;
}
