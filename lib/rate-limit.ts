import crypto from 'crypto';
import { adminDb } from './firebase-admin';

// Limitador de pedidos por chave, com janela fixa guardada em Firestore
// (colecção `rate_limits`, escrita só pelo Admin SDK — não há regra para ela
// nas firestore.rules, por isso nenhum cliente a lê ou escreve).
//
// A janela fixa é mais permissiva nas fronteiras do que uma janela deslizante,
// mas basta para o que aqui interessa: travar força bruta de OTP e envios em
// massa de WhatsApp. Serve também de contador para diagnóstico.

export interface ResultadoLimite {
  ok: boolean;
  // Pedidos que ainda cabem na janela actual
  restantes: number;
  // Segundos até a janela reiniciar (0 quando ok)
  esperarSegundos: number;
}

// O id do documento tem de ser seguro para o Firestore (sem '/' nem tamanho
// excessivo) e não deve expor o número de telefone em claro.
function idChave(chave: string): string {
  return crypto.createHash('sha256').update(chave).digest('hex').slice(0, 32);
}

export async function consumir(
  chave: string,
  { max, janelaMs }: { max: number; janelaMs: number },
): Promise<ResultadoLimite> {
  const ref = adminDb.collection('rate_limits').doc(idChave(chave));

  try {
    return await adminDb.runTransaction(async (tx) => {
      const agora = Date.now();
      const snap = await tx.get(ref);
      const dados = snap.data();
      const reiniciaEm = typeof dados?.reinicia_em === 'number' ? dados.reinicia_em : 0;

      // Janela expirada (ou inexistente): começa uma nova
      if (!snap.exists || reiniciaEm <= agora) {
        tx.set(ref, { contagem: 1, reinicia_em: agora + janelaMs, chave: idChave(chave) });
        return { ok: true, restantes: max - 1, esperarSegundos: 0 };
      }

      const contagem = typeof dados?.contagem === 'number' ? dados.contagem : 0;
      if (contagem >= max) {
        return { ok: false, restantes: 0, esperarSegundos: Math.ceil((reiniciaEm - agora) / 1000) };
      }

      tx.update(ref, { contagem: contagem + 1 });
      return { ok: true, restantes: max - contagem - 1, esperarSegundos: 0 };
    });
  } catch (err) {
    // Falhar fechado: se o contador não está disponível, não se deixa passar o
    // pedido — estes limites protegem endpoints anónimos.
    console.error('[rate-limit] erro na transacção', err);
    return { ok: false, restantes: 0, esperarSegundos: Math.ceil(janelaMs / 1000) };
  }
}

// Liberta a janela de uma chave (ex.: OTP verificado com sucesso, não vale a
// pena manter as tentativas falhadas a contar contra o utilizador legítimo).
export async function libertar(chave: string): Promise<void> {
  try {
    await adminDb.collection('rate_limits').doc(idChave(chave)).delete();
  } catch { /* não é crítico */ }
}

// IP do cliente atrás do proxy do Netlify. Como o cabeçalho pode ser forjado
// quando a app corre fora do Netlify, o IP é sempre um limite secundário —
// nunca a única defesa.
export function ipDoPedido(req: Request): string {
  const nf = req.headers.get('x-nf-client-connection-ip');
  if (nf) return nf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'desconhecido';
}
