// Envio de email pela API do Brevo, mais os templates da loja.
//
// Vive aqui, e não na rota /api/send-email, porque há emails que nascem no
// servidor (encomenda criada, pagamento confirmado) e não têm um pedido do
// cliente a que se autenticar. A rota continua a servir os que partem do
// browser e importa daqui.

import { referenciaEncomenda } from './referencia';
import { nomeMetodo } from './metodos-pagamento';

export interface Envio {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

// Lido a cada chamada: em serverless o módulo sobrevive entre pedidos e uma
// constante de topo fixaria valores de um arranque antigo.
export function configEmail() {
  const LOJA_NOME        = process.env.LOJA_NOME  || 'Real Stiles';
  const LOJA_URL         = process.env.LOJA_URL   || 'https://realstiles.co.mz';
  const FROM_ENCOMENDAS  = process.env.FROM_EMAIL_ENCOMENDAS  || 'encomendas@realstiles.co.mz';
  const FROM_RECLAMACOES = process.env.FROM_EMAIL_RECLAMACOES || 'reclamacoes@realstiles.co.mz';
  const FROM_NOREPLY     = process.env.FROM_EMAIL_NOREPLY     || 'noreply@realstiles.co.mz';
  return {
    BREVO_KEY: process.env.BREVO_API_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    LOJA_NOME, LOJA_URL,
    FROM_ENCOMENDAS, FROM_RECLAMACOES, FROM_NOREPLY,
    // As notificações internas vão para a caixa do próprio endereço de serviço:
    // encomendas@ e reclamacoes@ são grupos, logo chegam à equipa respetiva
    ADMIN_ENCOMENDAS: FROM_ENCOMENDAS,
    ADMIN_RECLAMACOES: FROM_RECLAMACOES,
  };
}

// Entrega os envios e devolve as mensagens de erro dos que falharam. Nunca
// atira: um email que não sai não pode derrubar a encomenda que o motivou.
export async function enviarEmails(envios: Envio[]): Promise<string[]> {
  const { BREVO_KEY, LOJA_NOME } = configEmail();
  if (!BREVO_KEY) return ['BREVO_API_KEY em falta'];
  if (envios.length === 0) return [];

  const resultados = await Promise.allSettled(envios.map(e => {
    const m = e.from.match(/^(.*?)\s*<(.+)>$/);
    const senderName  = m ? m[1].trim() : LOJA_NOME;
    const senderEmail = m ? m[2] : e.from;
    return fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: e.to.map(addr => ({ email: addr })),
        subject: e.subject,
        htmlContent: e.html,
      }),
    }).then(async r => {
      const b = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(b));
      return b;
    });
  }));

  return resultados
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => String(r.reason?.message ?? r.reason));
}


// ── Encomendas: avisos disparados pelo servidor ─────────────────────

// Quem escolheu ser avisado por WhatsApp não recebe estes emails.
function clientePorEmail(enc: Record<string, unknown>): string {
  if (enc.notif_canal === 'whatsapp') return '';
  return String(enc.cliente_email || '');
}

// A encomenda nasce `pendente`: o cliente ainda tem de pagar. Este email
// confirma que ficou registada e leva-o de volta ao pagamento.
export async function notificarEncomendaCriada(
  encomendaId: string,
  enc: Record<string, unknown>,
): Promise<void> {
  const cfg = configEmail();
  const email = clientePorEmail(enc);
  if (!email) return;

  const ref = referenciaEncomenda({
    id: encomendaId,
    numero_sequencial: Number(enc.numero_sequencial) || undefined,
  });
  const total = Number(enc.total) || 0;

  const erros = await enviarEmails([{
    from: `${cfg.LOJA_NOME} <${cfg.FROM_ENCOMENDAS}>`,
    to: [email],
    subject: `Encomenda ${ref} registada — falta pagar`,
    html: wrap(cfg.LOJA_NOME, cfg.LOJA_URL, `
    <h2 style="margin-top:0;">⏳ Encomenda registada</h2>
    <p style="color:#666;font-size:14px;">Referência: <strong>${ref}</strong></p>
    <p style="font-size:14px;line-height:1.7;">A tua encomenda ficou guardada, mas <strong>ainda não está paga</strong>. Só a preparamos depois de recebermos o pagamento.</p>
    <div style="margin-top:24px;padding:16px;background:#f8f8f8;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">VALOR A PAGAR</p>
      <p style="margin:0;font-size:20px;font-weight:700;">${total.toFixed(2)} MZN</p>
      <p style="margin:8px 0 0;font-size:13px;color:#666;">Método escolhido: ${esc(nomeMetodo(enc.pagamento_metodo as string))}</p>
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${cfg.LOJA_URL}/encomenda/${encomendaId}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Pagar agora</a>
    </div>`),
  }]);
  if (erros.length) console.error('[email] encomenda criada', ref, erros);
}

// Pagamento confirmado: avisa o cliente e a equipa. A equipa só é chamada
// aqui, quando há dinheiro — encomendas abandonadas no pagamento não a
// interessam.
export async function notificarEncomendaPaga(
  encomendaId: string,
  enc: Record<string, unknown>,
): Promise<void> {
  const cfg = configEmail();
  const ref = referenciaEncomenda({
    id: encomendaId,
    numero_sequencial: Number(enc.numero_sequencial) || undefined,
  });
  const total = Number(enc.total) || 0;
  const morada = [enc.morada_entrega, enc.cidade_entrega].filter(Boolean).join(', ');
  const envios: Envio[] = [];

  const email = clientePorEmail(enc);
  if (email) {
    envios.push({
      from: `${cfg.LOJA_NOME} <${cfg.FROM_ENCOMENDAS}>`,
      to: [email],
      subject: `✅ Pagamento confirmado — encomenda ${ref}`,
      html: wrap(cfg.LOJA_NOME, cfg.LOJA_URL, `
    <h2 style="margin-top:0;">✅ Pagamento confirmado</h2>
    <p style="color:#666;font-size:14px;">Referência: <strong>${ref}</strong></p>
    <p style="font-size:14px;line-height:1.7;">Recebemos o teu pagamento de <strong>${total.toFixed(2)} MZN</strong>. A encomenda entrou em preparação e avisamos-te quando seguir.</p>
    <div style="margin-top:24px;text-align:center;">
      <a href="${cfg.LOJA_URL}/encomenda/${encomendaId}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver a encomenda</a>
    </div>`),
    });
  }

  if (cfg.ADMIN_ENCOMENDAS) {
    envios.push({
      from: `${cfg.LOJA_NOME} <${cfg.FROM_ENCOMENDAS}>`,
      to: [cfg.ADMIN_ENCOMENDAS],
      subject: `🛍️ Encomenda paga ${ref}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2>Encomenda paga</h2>
        <p><strong>Cliente:</strong> ${esc(enc.cliente_email)}</p>
        <p><strong>Total:</strong> ${total.toFixed(2)} MZN</p>
        <p><strong>Método:</strong> ${esc(nomeMetodo(enc.pagamento_metodo as string))}</p>
        <p><strong>Morada:</strong> ${esc(morada)}</p>
        <p style="margin-top:20px;">
          <a href="${cfg.LOJA_URL}/admin/encomendas" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver no painel admin
          </a>
        </p>
      </div>`,
    });
  }

  const erros = await enviarEmails(envios);
  if (erros.length) console.error('[email] encomenda paga', ref, erros);
}

// ── Templates ─────────────────────────────────────────────────────────────────

// Todo o valor que venha de um utilizador (nome, morada, assunto, descrição,
// nome de artigo) passa por aqui antes de entrar no HTML do email.
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Texto de várias linhas: escapado primeiro, só depois com os <br>
export function escMultilinha(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

export interface ItemEmail {
  nome?: string;
  tamanho?: string;
  cor?: string;
  preco?: number;
  quantidade?: number;
}

export function estadoLabel(estado: string) {
  const labels: Record<string, string> = {
    pendente: 'Pendente', confirmada: 'Confirmada',
    enviada: 'Enviada', entregue: 'Entregue', cancelada: 'Cancelada',
  };
  return labels[estado] || estado;
}

export function cabecalho(lojaNome: string) {
  return `<div style="background:#0d1347;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;font-size:20px;margin:0;letter-spacing:0.02em;">${lojaNome}</h1>
  </div>`;
}

export function rodape(lojaUrl: string, lojaNome: string) {
  return `<div style="padding:20px 32px;text-align:center;border-top:1px solid #eee;margin-top:24px;">
    <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} ${lojaNome} · <a href="${lojaUrl}" style="color:#aaa;">${lojaUrl.replace('https://', '')}</a></p>
  </div>`;
}

export function wrap(lojaNome: string, lojaUrl: string, inner: string) {
  return `<!DOCTYPE html><html lang="pt"><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;">
    ${cabecalho(lojaNome)}
    <div style="background:white;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      ${inner}
      ${rodape(lojaUrl, lojaNome)}
    </div>
  </div>
  </body></html>`;
}

export function gerarEmailConfirmacao(
  ref: string,
  itens: ItemEmail[],
  total: number, morada: string, lojaNome: string, lojaUrl: string
) {
  const itensHtml = itens.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${esc(i.nome)}${i.tamanho ? ` <span style="color:#888;font-size:12px">(${esc(i.tamanho)})</span>` : ''}${i.cor ? ` <span style="color:#888;font-size:12px">· ${esc(i.cor)}</span>` : ''}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${Number(i.quantidade) || 0}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${((Number(i.preco) || 0) * (Number(i.quantidade) || 0)).toFixed(2)} MZN</td>
    </tr>`).join('');

  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Encomenda recebida!</h2>
    <p style="color:#666;font-size:14px;">Referência: <strong>${ref}</strong></p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
      <thead><tr style="background:#f8f8f8;">
        <th style="padding:10px 8px;text-align:left;font-size:12px;color:#888;">PRODUTO</th>
        <th style="padding:10px 8px;text-align:center;font-size:12px;color:#888;">QTD</th>
        <th style="padding:10px 8px;text-align:right;font-size:12px;color:#888;">TOTAL</th>
      </tr></thead>
      <tbody>${itensHtml}</tbody>
      <tfoot><tr style="background:#f8f8f8;">
        <td colspan="2" style="padding:12px 8px;font-weight:700;">Total</td>
        <td style="padding:12px 8px;font-weight:700;text-align:right;">${Number(total)?.toFixed(2)} MZN</td>
      </tr></tfoot>
    </table>
    <div style="margin-top:24px;padding:16px;background:#f8f8f8;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">MORADA DE ENTREGA</p>
      <p style="margin:0;font-size:14px;">${esc(morada)}</p>
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver as minhas encomendas</a>
    </div>`);
}

export function gerarEmailReclamacaoAdmin(
  nome: string, email: string, telefone: string,
  assunto: string, descricao: string, lojaNome: string, lojaUrl: string
) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;color:#c0392b;">📣 Nova reclamação recebida</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;font-size:13px;color:#888;width:100px;">Nome</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${esc(nome)}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#888;">Email</td><td style="padding:8px 0;font-size:14px;">${esc(email)}</td></tr>
      ${telefone ? `<tr><td style="padding:8px 0;font-size:13px;color:#888;">Telefone</td><td style="padding:8px 0;font-size:14px;">${esc(telefone)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;font-size:13px;color:#888;">Assunto</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${esc(assunto)}</td></tr>
    </table>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Descrição</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#333;">${escMultilinha(descricao)}</p>
    </div>
    <a href="${lojaUrl}/admin/reclamacoes" style="display:inline-block;background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Responder no painel admin
    </a>`);
}

export function gerarEmailReclamacaoCliente(nome: string, assunto: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Reclamação recebida</h2>
    <p style="font-size:15px;">Olá <strong>${esc(nome)}</strong>,</p>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      Recebemos a sua reclamação relativa a <strong>${esc(assunto)}</strong>.<br>
      A nossa equipa irá analisar o caso e responder-lhe no prazo de <strong>3 dias úteis</strong>.
    </p>
    <div style="background:#f0f7f0;border-left:4px solid #27ae60;border-radius:4px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#27ae60;font-weight:600;">Referência registada com sucesso.</p>
    </div>
    <p style="font-size:13px;color:#888;margin-bottom:20px;">
      Este email é apenas uma notificação — a resposta e a conversa com a nossa equipa ficam disponíveis na área do cliente.
    </p>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver a minha reclamação</a>
    </div>`);
}

export function gerarEmailEstado(
  ref: string, estado: string, notas: string | undefined,
  lojaNome: string, lojaUrl: string
) {
  const icones: Record<string, string> = {
    confirmada: '✅', enviada: '🚚', entregue: '🎉', cancelada: '❌', pendente: '⏳',
  };
  const icone = icones[estado] || '📦';
  const mensagens: Record<string, string> = {
    confirmada: 'A tua encomenda foi confirmada e está a ser preparada.',
    enviada: 'A tua encomenda foi enviada e está a caminho!',
    entregue: 'A tua encomenda foi entregue. Esperamos que gostes!',
    cancelada: 'A tua encomenda foi cancelada. Contacta-nos se precisares de ajuda.',
    pendente: 'A tua encomenda está pendente de confirmação.',
  };
  const mensagem = mensagens[estado] || `O estado foi actualizado para ${estadoLabel(estado)}.`;

  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">${icone} Actualização da encomenda</h2>
    <p style="font-size:13px;color:#888;">Referência: <strong>${ref}</strong></p>
    <div style="text-align:center;margin:24px 0;padding:20px;background:#f8f8f8;border-radius:12px;">
      <p style="font-size:32px;margin:0 0 8px;">${icone}</p>
      <p style="font-size:18px;font-weight:700;margin:0 0 4px;">${estadoLabel(estado)}</p>
      <p style="font-size:14px;color:#666;margin:0;">${mensagem}</p>
    </div>
    ${notas ? `<div style="background:#fffbf0;border-left:4px solid #f39c12;border-radius:4px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:12px;color:#f39c12;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Nota da loja</p>
      <p style="margin:0;font-size:14px;color:#333;">${escMultilinha(notas)}</p>
    </div>` : ''}
    <div style="text-align:center;">
      <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver encomenda</a>
    </div>`);
}

export function gerarEmailBemVindo(nome: string, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">🎉 Bem-vindo(a) à ${lojaNome}!</h2>
    <p style="font-size:15px;">Olá <strong>${esc(nome || 'Cliente')}</strong>,</p>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      A tua conta foi criada com sucesso. Já podes explorar a nossa coleção e fazer encomendas de forma rápida e segura.
    </p>
    <div style="margin:20px 0;">
      <div style="padding:14px;background:#f8f8f8;border-radius:8px;font-size:13px;margin-bottom:8px;">✅ Entrega em todo Moçambique</div>
      <div style="padding:14px;background:#f8f8f8;border-radius:8px;font-size:13px;margin-bottom:8px;">🔒 Pagamento seguro</div>
      <div style="padding:14px;background:#f8f8f8;border-radius:8px;font-size:13px;">📦 Acompanha as tuas encomendas em tempo real</div>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${lojaUrl}" style="display:inline-block;background:#0d1347;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Começar a comprar</a>
    </div>`);
}

export function gerarEmailReclamacaoResolvida(assunto: string, estado: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Reclamação resolvida</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      A sua reclamação relativa a <strong>${esc(assunto)}</strong> foi marcada como <strong>${esc(estado)}</strong> pela nossa equipa.
    </p>
    <div style="background:#f0f7f0;border-left:4px solid #27ae60;border-radius:4px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#27ae60;font-weight:600;">Caso considere que o assunto não ficou resolvido, pode consultar a conversa completa na área do cliente.</p>
    </div>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver a minha reclamação</a>
    </div>`);
}

export function gerarEmailRespostaReclamacao(
  resposta: string, assunto: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string
) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✉️ Resposta à sua reclamação</h2>
    <p style="font-size:13px;color:#888;margin-bottom:20px;">Assunto: <strong>${esc(assunto)}</strong></p>
    <div style="background:#f8f8f8;border-radius:8px;padding:20px;font-size:14px;line-height:1.8;color:#333;">
      ${escMultilinha(resposta)}
    </div>
    <p style="font-size:13px;color:#888;margin-top:20px;margin-bottom:20px;">
      Para continuar esta conversa, responda na área do cliente — este email não é monitorizado.
    </p>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Responder na área do cliente</a>
    </div>`);
}
