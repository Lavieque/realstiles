// ── send-email.js ──
// Netlify Function para envio de emails via Resend

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { tipo, encomenda_id, cliente_email, itens, total, morada } = JSON.parse(event.body);
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    if (!RESEND_KEY) {
      console.warn('RESEND_API_KEY não configurado');
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, warn: 'email não configurado' }) };
    }

    let emailData;

    if (tipo === 'confirmacao_encomenda') {
      emailData = {
        from: 'ClothesShop <noreply@clothesshop.com>',
        to: cliente_email,
        subject: `✅ Encomenda #${encomenda_id.substring(0,8)} recebida!`,
        html: gerarEmailConfirmacao(encomenda_id, itens, total, morada)
      };
    } else if (tipo === 'nova_encomenda_admin') {
      emailData = {
        from: 'ClothesShop <noreply@clothesshop.com>',
        to: ADMIN_EMAIL,
        subject: `🛍️ Nova encomenda #${encomenda_id.substring(0,8)}`,
        html: `<p>Nova encomenda recebida de <strong>${cliente_email}</strong>.<br/>Total: <strong>${total?.toFixed(2)} MZN</strong><br/><a href="https://clothesshop.com/admin/encomendas.html">Ver no painel</a></p>`
      };
    }

    if (emailData) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function gerarEmailConfirmacao(id, itens = [], total, morada) {
  const itensHtml = itens.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i.nome} ${i.tamanho ? `(${i.tamanho})` : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantidade}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(i.preco * i.quantidade).toFixed(2)} MZN</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#0a0a0a;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;font-size:24px;margin:0">Clothes<span style="color:#c8a96e">Shop</span></h1>
      </div>
      <div style="background:#f9f9f9;padding:32px;border-radius:0 0 12px 12px">
        <h2 style="font-size:20px;margin-bottom:8px">✅ Encomenda recebida!</h2>
        <p style="color:#666;margin-bottom:24px">Referência: <strong>#${id.substring(0,8).toUpperCase()}</strong></p>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#f0f0f0">
            <th style="padding:10px;text-align:left;font-size:13px">Produto</th>
            <th style="padding:10px;text-align:center;font-size:13px">Qtd</th>
            <th style="padding:10px;text-align:right;font-size:13px">Total</th>
          </tr></thead>
          <tbody>${itensHtml}</tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:12px;font-weight:700">Total</td>
            <td style="padding:12px;font-weight:700;text-align:right">${total?.toFixed(2)} MZN</td>
          </tr></tfoot>
        </table>
        <p style="margin-top:20px;color:#666;font-size:14px"><strong>Morada de entrega:</strong><br/>${morada}</p>
        <p style="margin-top:16px;color:#999;font-size:13px">Entraremos em contacto em breve para confirmar a entrega.</p>
      </div>
    </div>
  `;
}
