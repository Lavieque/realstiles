import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipo } = body;

    const BREVO_KEY         = process.env.BREVO_API_KEY;
    const ADMIN_EMAIL       = process.env.ADMIN_EMAIL;
    const LOJA_NOME         = process.env.LOJA_NOME  || 'Real Stiles';
    const LOJA_URL          = process.env.LOJA_URL   || 'https://realstiles.co.mz';
    const FROM_ENCOMENDAS   = process.env.FROM_EMAIL_ENCOMENDAS  || 'encomendas@realstiles.co.mz';
    const FROM_RECLAMACOES  = process.env.FROM_EMAIL_RECLAMACOES || 'reclamacoes@realstiles.co.mz';
    const FROM_NOREPLY      = process.env.FROM_EMAIL_NOREPLY     || 'noreply@realstiles.co.mz';

    if (!BREVO_KEY) {
      return NextResponse.json({ ok: false, warn: 'BREVO_API_KEY em falta' });
    }

    const envios: { from: string; to: string[]; subject: string; html: string }[] = [];

    // ── Confirmação de encomenda → cliente + admin ──────────────────────────
    if (tipo === 'confirmacao_encomenda') {
      const { encomenda_id, cliente_email, itens, total, morada } = body;
      if (cliente_email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [cliente_email],
          subject: `✅ Encomenda #${encomenda_id.substring(0, 8).toUpperCase()} recebida — ${LOJA_NOME}`,
          html: gerarEmailConfirmacao(encomenda_id, itens, total, morada, LOJA_NOME, LOJA_URL),
        });
      }
      if (ADMIN_EMAIL) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [ADMIN_EMAIL],
          subject: `🛍️ Nova encomenda #${encomenda_id.substring(0, 8).toUpperCase()} de ${cliente_email}`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2>Nova encomenda recebida</h2>
            <p><strong>Cliente:</strong> ${cliente_email}</p>
            <p><strong>Total:</strong> ${Number(total)?.toFixed(2)} MZN</p>
            <p><strong>Morada:</strong> ${morada}</p>
            <p style="margin-top:20px;">
              <a href="${LOJA_URL}/admin/encomendas" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver no painel admin
              </a>
            </p>
          </div>`,
        });
      }
    }

    // ── Reclamação → admin (notificação) + cliente (acuse de recepção) ───────
    if (tipo === 'reclamacao') {
      const { nome, email, telefone, assunto, descricao, reclamacao_id } = body;
      if (ADMIN_EMAIL) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [ADMIN_EMAIL],
          subject: `📣 Nova reclamação: ${assunto}`,
          html: gerarEmailReclamacaoAdmin(nome, email, telefone, assunto, descricao, LOJA_NOME, LOJA_URL),
        });
      }
      if (email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [email],
          subject: `✅ Reclamação recebida — ${LOJA_NOME}`,
          html: gerarEmailReclamacaoCliente(nome, assunto, reclamacao_id, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Nova mensagem do cliente numa reclamação → admin ────────────────────
    if (tipo === 'mensagem_reclamacao_cliente') {
      const { nome, assunto, mensagem } = body;
      if (ADMIN_EMAIL) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [ADMIN_EMAIL],
          subject: `💬 Nova mensagem de ${nome} — ${assunto}`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2>Nova mensagem numa reclamação</h2>
            <p><strong>Cliente:</strong> ${nome}</p>
            <p><strong>Assunto:</strong> ${assunto}</p>
            <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;line-height:1.7;">${(mensagem || '').replace(/\n/g, '<br>')}</div>
            <p style="margin-top:20px;">
              <a href="${LOJA_URL}/admin/reclamacoes" style="background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver e responder
              </a>
            </p>
          </div>`,
        });
      }
    }

    // ── Mudança de estado da encomenda → cliente ────────────────────────────
    if (tipo === 'estado_encomenda') {
      const { encomenda_id, cliente_email, estado, notas } = body;
      if (cliente_email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_ENCOMENDAS}>`,
          to: [cliente_email],
          subject: `📦 Encomenda #${encomenda_id.substring(0, 8).toUpperCase()} — ${estadoLabel(estado)}`,
          html: gerarEmailEstado(encomenda_id, estado, notas, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Bem-vindo no registo → cliente ──────────────────────────────────────
    if (tipo === 'bem_vindo') {
      const { nome, email } = body;
      if (email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_NOREPLY}>`,
          to: [email],
          subject: `Bem-vindo à ${LOJA_NOME}! 🎉`,
          html: gerarEmailBemVindo(nome, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Resposta a reclamação (do admin) → cliente ──────────────────────────
    if (tipo === 'resposta_reclamacao') {
      const { cliente_email, assunto, resposta, reclamacao_id } = body;
      if (cliente_email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [cliente_email],
          subject: `Re: ${assunto} — ${LOJA_NOME}`,
          html: gerarEmailRespostaReclamacao(resposta, assunto, reclamacao_id, LOJA_NOME, LOJA_URL),
        });
      }
    }

    // ── Reclamação marcada como resolvida → cliente ─────────────────────────
    if (tipo === 'reclamacao_resolvida') {
      const { cliente_email, assunto, estado, reclamacao_id } = body;
      if (cliente_email) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_RECLAMACOES}>`,
          to: [cliente_email],
          subject: `✅ Reclamação resolvida — ${LOJA_NOME}`,
          html: gerarEmailReclamacaoResolvida(assunto, estado, reclamacao_id, LOJA_NOME, LOJA_URL),
        });
      }
    }

    if (envios.length === 0) {
      return NextResponse.json({ ok: false, warn: `Tipo de email desconhecido: ${tipo}` });
    }

    const resultados = await Promise.allSettled(
      envios.map(e => {
        const m = e.from.match(/^(.*?)\s*<(.+)>$/);
        const senderName  = m ? m[1].trim() : LOJA_NOME;
        const senderEmail = m ? m[2] : e.from;
        return fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': BREVO_KEY!, 'Content-Type': 'application/json' },
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
      })
    );

    const erros = resultados
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message);

    return NextResponse.json({ ok: true, ...(erros.length ? { erros } : {}) });
  } catch (err) {
    console.error('send-email error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function estadoLabel(estado: string) {
  const labels: Record<string, string> = {
    pendente: 'Pendente', confirmada: 'Confirmada',
    enviada: 'Enviada', entregue: 'Entregue', cancelada: 'Cancelada',
  };
  return labels[estado] || estado;
}

function cabecalho(lojaNome: string) {
  return `<div style="background:#0d1347;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;font-size:20px;margin:0;letter-spacing:0.02em;">${lojaNome}</h1>
  </div>`;
}

function rodape(lojaUrl: string, lojaNome: string) {
  return `<div style="padding:20px 32px;text-align:center;border-top:1px solid #eee;margin-top:24px;">
    <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} ${lojaNome} · <a href="${lojaUrl}" style="color:#aaa;">${lojaUrl.replace('https://', '')}</a></p>
  </div>`;
}

function wrap(lojaNome: string, lojaUrl: string, inner: string) {
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

function gerarEmailConfirmacao(
  id: string,
  itens: { nome: string; tamanho?: string; cor?: string; preco: number; quantidade: number }[],
  total: number, morada: string, lojaNome: string, lojaUrl: string
) {
  const itensHtml = itens.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${i.nome}${i.tamanho ? ` <span style="color:#888;font-size:12px">(${i.tamanho})</span>` : ''}${i.cor ? ` <span style="color:#888;font-size:12px">· ${i.cor}</span>` : ''}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${i.quantidade}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${(i.preco * i.quantidade).toFixed(2)} MZN</td>
    </tr>`).join('');

  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Encomenda recebida!</h2>
    <p style="color:#666;font-size:14px;">Referência: <strong>#${id.substring(0, 8).toUpperCase()}</strong></p>
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
      <p style="margin:0;font-size:14px;">${morada}</p>
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver as minhas encomendas</a>
    </div>`);
}

function gerarEmailReclamacaoAdmin(
  nome: string, email: string, telefone: string,
  assunto: string, descricao: string, lojaNome: string, lojaUrl: string
) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;color:#c0392b;">📣 Nova reclamação recebida</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;font-size:13px;color:#888;width:100px;">Nome</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${nome}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#888;">Email</td><td style="padding:8px 0;font-size:14px;">${email}</td></tr>
      ${telefone ? `<tr><td style="padding:8px 0;font-size:13px;color:#888;">Telefone</td><td style="padding:8px 0;font-size:14px;">${telefone}</td></tr>` : ''}
      <tr><td style="padding:8px 0;font-size:13px;color:#888;">Assunto</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${assunto}</td></tr>
    </table>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Descrição</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#333;">${descricao}</p>
    </div>
    <a href="${lojaUrl}/admin/reclamacoes" style="display:inline-block;background:#0d1347;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Responder no painel admin
    </a>`);
}

function gerarEmailReclamacaoCliente(nome: string, assunto: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Reclamação recebida</h2>
    <p style="font-size:15px;">Olá <strong>${nome}</strong>,</p>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      Recebemos a sua reclamação relativa a <strong>${assunto}</strong>.<br>
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

function gerarEmailEstado(
  id: string, estado: string, notas: string | undefined,
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
    <p style="font-size:13px;color:#888;">Referência: <strong>#${id.substring(0, 8).toUpperCase()}</strong></p>
    <div style="text-align:center;margin:24px 0;padding:20px;background:#f8f8f8;border-radius:12px;">
      <p style="font-size:32px;margin:0 0 8px;">${icone}</p>
      <p style="font-size:18px;font-weight:700;margin:0 0 4px;">${estadoLabel(estado)}</p>
      <p style="font-size:14px;color:#666;margin:0;">${mensagem}</p>
    </div>
    ${notas ? `<div style="background:#fffbf0;border-left:4px solid #f39c12;border-radius:4px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:12px;color:#f39c12;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Nota da loja</p>
      <p style="margin:0;font-size:14px;color:#333;">${notas}</p>
    </div>` : ''}
    <div style="text-align:center;">
      <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver encomenda</a>
    </div>`);
}

function gerarEmailBemVindo(nome: string, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">🎉 Bem-vindo(a) à ${lojaNome}!</h2>
    <p style="font-size:15px;">Olá <strong>${nome || 'Cliente'}</strong>,</p>
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

function gerarEmailReclamacaoResolvida(assunto: string, estado: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✅ Reclamação resolvida</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;">
      A sua reclamação relativa a <strong>${assunto}</strong> foi marcada como <strong>${estado}</strong> pela nossa equipa.
    </p>
    <div style="background:#f0f7f0;border-left:4px solid #27ae60;border-radius:4px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#27ae60;font-weight:600;">Caso considere que o assunto não ficou resolvido, pode consultar a conversa completa na área do cliente.</p>
    </div>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver a minha reclamação</a>
    </div>`);
}

function gerarEmailRespostaReclamacao(
  resposta: string, assunto: string, reclamacaoId: string | undefined, lojaNome: string, lojaUrl: string
) {
  return wrap(lojaNome, lojaUrl, `
    <h2 style="margin-top:0;">✉️ Resposta à sua reclamação</h2>
    <p style="font-size:13px;color:#888;margin-bottom:20px;">Assunto: <strong>${assunto}</strong></p>
    <div style="background:#f8f8f8;border-radius:8px;padding:20px;font-size:14px;line-height:1.8;color:#333;">
      ${resposta.replace(/\n/g, '<br>')}
    </div>
    <p style="font-size:13px;color:#888;margin-top:20px;margin-bottom:20px;">
      Para continuar esta conversa, responda na área do cliente — este email não é monitorizado.
    </p>
    <div style="text-align:center;">
      <a href="${lojaUrl}${reclamacaoId ? `/reclamacoes/${reclamacaoId}` : '/reclamacoes'}" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Responder na área do cliente</a>
    </div>`);
}
