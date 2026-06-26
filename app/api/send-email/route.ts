import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { tipo, encomenda_id, cliente_email, itens, total, morada } = await req.json();

    const RESEND_KEY  = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const FROM_EMAIL  = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const LOJA_NOME   = process.env.LOJA_NOME  || 'Real Stiles';
    const LOJA_URL    = process.env.LOJA_URL   || 'https://realstiles.netlify.app';

    if (!RESEND_KEY) {
      return NextResponse.json({ ok: false, warn: 'RESEND_API_KEY em falta' });
    }

    const envios: object[] = [];

    if (tipo === 'confirmacao_encomenda' && cliente_email) {
      envios.push({
        from: `${LOJA_NOME} <${FROM_EMAIL}>`,
        to: [cliente_email],
        subject: `✅ Encomenda #${encomenda_id.substring(0, 8).toUpperCase()} recebida — ${LOJA_NOME}`,
        html: gerarEmailCliente(encomenda_id, itens, total, morada, LOJA_NOME, LOJA_URL),
      });

      if (ADMIN_EMAIL) {
        envios.push({
          from: `${LOJA_NOME} <${FROM_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `🛍️ Nova encomenda #${encomenda_id.substring(0, 8).toUpperCase()} de ${cliente_email}`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2>Nova encomenda recebida</h2>
            <p><strong>Cliente:</strong> ${cliente_email}</p>
            <p><strong>Total:</strong> ${total?.toFixed(2)} MZN</p>
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

    const resultados = await Promise.allSettled(
      envios.map(emailData =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailData),
        }).then(async r => {
          const body = await r.json();
          if (!r.ok) throw new Error(JSON.stringify(body));
          return body;
        })
      )
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

function gerarEmailCliente(
  id: string, itens: { nome: string; tamanho?: string; cor?: string; preco: number; quantidade: number }[],
  total: number, morada: string, lojaNome: string, lojaUrl: string
) {
  const itensHtml = itens.map(i => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${i.nome}${i.tamanho ? ` <span style="color:#888;font-size:12px">(${i.tamanho})</span>` : ''}${i.cor ? ` <span style="color:#888;font-size:12px">· ${i.cor}</span>` : ''}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${i.quantidade}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${(i.preco * i.quantidade).toFixed(2)} MZN</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="pt"><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:32px auto;">
      <div style="background:#0d1347;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;font-size:22px;margin:0;">${lojaNome}</h1>
      </div>
      <div style="background:white;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <h2>✅ Encomenda recebida!</h2>
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
            <td style="padding:12px 8px;font-weight:700;text-align:right;">${total?.toFixed(2)} MZN</td>
          </tr></tfoot>
        </table>
        <div style="margin-top:24px;padding:16px;background:#f8f8f8;border-radius:8px;">
          <p style="margin:0 0 4px;font-size:12px;color:#888;">MORADA DE ENTREGA</p>
          <p style="margin:0;font-size:14px;">${morada}</p>
        </div>
        <div style="margin-top:24px;text-align:center;">
          <a href="${lojaUrl}/encomendas" style="display:inline-block;background:#0d1347;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Ver as minhas encomendas</a>
        </div>
      </div>
    </div>
  </body></html>`;
}
