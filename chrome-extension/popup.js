const domainEl = document.getElementById('domain');
const btnCapture = document.getElementById('btn-capture');
const btnOptions = document.getElementById('btn-options');
const btnOptions2 = document.getElementById('btn-options-2');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const mainBody = document.getElementById('main-body');
const notConfigured = document.getElementById('not-configured');
const temuSection = document.getElementById('temu-section');
const btnTemuImport = document.getElementById('btn-temu-import');
const temuStatus = document.getElementById('temu-status');

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = 'status ' + type;
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

btnOptions.addEventListener('click', openOptions);
if (btnOptions2) btnOptions2.addEventListener('click', openOptions);

chrome.storage.local.get(['tradeflow_url', 'capture_token', 'realstiles_url'], async (cfg) => {
  if (!cfg.realstiles_url) {
    mainBody.style.display = 'none';
    notConfigured.style.display = 'block';
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  let domain = '';
  try {
    domain = new URL(tabUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = 'Domínio inválido';
  }
  domainEl.textContent = domain;

  // Mostrar secção Temu se estivermos em temu.com
  const isTemu = domain === 'temu.com' || domain.endsWith('.temu.com');
  if (isTemu) temuSection.style.display = 'block';

  // --- Temu Import ---
  btnTemuImport.addEventListener('click', async () => {
    btnTemuImport.disabled = true;
    showStatus(temuStatus, 'A extrair dados do produto...', 'loading');

    try {
      const realstilesBase = (cfg.realstiles_url || '').replace(/\/$/, '');
      if (!realstilesBase) {
        showStatus(temuStatus, 'URL do Realstiles não configurado. Vai às definições.', 'error');
        btnTemuImport.disabled = false;
        return;
      }

      // Extrair dados do produto na tab Temu actual
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractTemuProduct,
      });

      const produto = result?.result;
      if (!produto || !produto.nome) {
        showStatus(temuStatus, 'Não foi possível extrair dados. Certifica-te de que estás numa página de produto.', 'error');
        btnTemuImport.disabled = false;
        return;
      }

      // Ler token da tab do Realstiles que está em espera
      const realstilesHost = new URL(realstilesBase).hostname;
      const realstilesTabs = await chrome.tabs.query({ url: `*://${realstilesHost}/*` });
      let token = null;
      for (const rsTab of realstilesTabs) {
        const [tokenResult] = await chrome.scripting.executeScript({
          target: { tabId: rsTab.id },
          func: () => localStorage.getItem('rs_temu_token'),
        });
        if (tokenResult?.result) {
          token = tokenResult.result;
          break;
        }
      }

      // Se não há token em nenhuma tab aberta, gerar um novo e abrir/focar realstiles
      let openedNewTab = false;
      if (!token) {
        token = Math.random().toString(36).slice(2) + Date.now().toString(36);
        openedNewTab = true;
      }

      // Enviar dados para o Realstiles
      const postRes = await fetch(`${realstilesBase}/api/import/temu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, produto }),
      });

      if (!postRes.ok) throw new Error(`Erro ${postRes.status}`);

      if (openedNewTab) {
        // Focar tab do realstiles se existir, senão abrir nova
        const realstilesHost = new URL(realstilesBase).hostname;
        const existingTabs = await chrome.tabs.query({ url: `*://${realstilesHost}/*` });
        if (existingTabs.length > 0) {
          await chrome.tabs.update(existingTabs[0].id, { url: `${realstilesBase}/admin/importar?temu_token=${token}`, active: true });
          await chrome.windows.update(existingTabs[0].windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: `${realstilesBase}/admin/importar?temu_token=${token}` });
        }
        showStatus(temuStatus, '✓ Produto enviado! A abrir Realstiles...', 'success');
      } else {
        showStatus(temuStatus, '✓ Produto enviado! Volta ao Realstiles.', 'success');
      }
    } catch (err) {
      showStatus(temuStatus, 'Erro: ' + (err.message || 'Falha ao importar'), 'error');
      btnTemuImport.disabled = false;
    }
  });

  // --- Cookie Capture ---
  btnCapture.addEventListener('click', async () => {
    btnCapture.disabled = true;
    showStatus(statusEl, 'A capturar cookies...', 'loading');
    countEl.textContent = '';

    try {
      const cookies = await chrome.cookies.getAll({ domain });

      if (cookies.length === 0) {
        showStatus(statusEl, 'Nenhum cookie encontrado para este domínio. Abre o site e faz login primeiro.', 'error');
        btnCapture.disabled = false;
        return;
      }

      const cookieObjects = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: c.secure || false,
        httpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'Lax',
        expires: c.expirationDate || -1,
      }));

      const res = await fetch(`${cfg.tradeflow_url}/cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, cookies: JSON.stringify(cookieObjects), token: cfg.capture_token }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erro ${res.status}`);
      }

      showStatus(statusEl, `✓ ${cookies.length} cookies enviados para o TradeFlow!`, 'success');
      countEl.textContent = `Domínio: ${domain} · Cookies capturados: ${cookies.length} (incl. HttpOnly)`;
    } catch (err) {
      showStatus(statusEl, 'Erro: ' + (err.message || 'Não foi possível enviar os cookies.'), 'error');
    } finally {
      btnCapture.disabled = false;
    }
  });
});

// Função injectada na página Temu para extrair dados do produto
function extractTemuProduct() {
  try {
    // Tentar ler dados do __NEXT_DATA__ ou window state
    let data = null;

    // Estratégia 1: __NEXT_DATA__
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      try {
        const nextData = JSON.parse(nextDataEl.textContent);
        const props = nextData?.props?.pageProps;
        if (props?.goods_detail_v2 || props?.goods_detail) {
          data = props.goods_detail_v2 || props.goods_detail;
        }
      } catch {}
    }

    // Estratégia 2: script tags com product data JSON
    if (!data) {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const s of scripts) {
        try {
          const parsed = JSON.parse(s.textContent);
          if (parsed?.goods_name || parsed?.name) { data = parsed; break; }
        } catch {}
      }
    }

    // Estratégia 3: DOM directo
    const nome =
      data?.goods_name ||
      data?.name ||
      document.querySelector('h1[class*="title"], [class*="goods-title"], [class*="product-title"]')?.textContent?.trim() ||
      document.title.split('|')[0].trim();

    const precoRaw =
      data?.min_normal_price ||
      data?.price ||
      document.querySelector('[class*="price-current"], [class*="sale-price"], [class*="goods-price"]')?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') ||
      '0';

    const preco = parseFloat(String(precoRaw).replace(/[^0-9.]/g, '')) || 0;

    // Imagens
    let imagens = [];
    if (data?.images || data?.goods_imgs) {
      const imgs = data.images || data.goods_imgs;
      imagens = (Array.isArray(imgs) ? imgs : []).map(i => typeof i === 'string' ? i : i.url || i.thumb_url || '').filter(Boolean).slice(0, 8);
    }
    if (imagens.length === 0) {
      document.querySelectorAll('img[class*="goods"], img[class*="product"], [class*="carousel"] img').forEach(img => {
        const src = img.src || img.dataset.src;
        if (src && src.startsWith('http') && !imagens.includes(src)) imagens.push(src);
      });
      imagens = imagens.slice(0, 8);
    }

    // Tamanhos e cores
    const tamanhos = [];
    const cores = [];
    if (data?.sku_list || data?.skus) {
      const skus = data.sku_list || data.skus || [];
      skus.forEach(sku => {
        (sku.attributes || sku.specs || []).forEach(attr => {
          const key = (attr.attr_name || attr.name || '').toLowerCase();
          const val = attr.attr_value || attr.value || '';
          if (key.includes('size') || key.includes('tamanho')) { if (!tamanhos.includes(val)) tamanhos.push(val); }
          if (key.includes('color') || key.includes('cor')) { if (!cores.includes(val)) cores.push(val); }
        });
      });
    }

    const descricao = data?.goods_desc || data?.description || document.querySelector('[class*="description"]')?.textContent?.trim()?.slice(0, 1000) || '';

    return {
      nome,
      preco,
      descricao,
      imagens,
      tamanhos,
      cores,
      url: window.location.href,
      fonte: 'temu',
    };
  } catch (e) {
    return null;
  }
}
