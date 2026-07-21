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
      // Usar getAllTabs sem filtro de URL para evitar falhas do chrome.tabs.query
      const realstilesHost = new URL(realstilesBase).hostname;
      const allTabs = await chrome.tabs.query({});
      const realstilesTabs = allTabs.filter(t => {
        try { return new URL(t.url || '').hostname === realstilesHost; } catch { return false; }
      });

      let token = null;
      for (const rsTab of realstilesTabs) {
        try {
          const [tokenResult] = await chrome.scripting.executeScript({
            target: { tabId: rsTab.id },
            func: () => localStorage.getItem('rs_temu_token'),
          });
          if (tokenResult?.result) {
            token = tokenResult.result;
            break;
          }
        } catch { /* tab pode não aceitar executeScript */ }
      }

      // Se não há token em nenhuma tab aberta, gerar um novo e abrir tab nova
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
        chrome.tabs.create({ url: `${realstilesBase}/admin/importar?temu_token=${token}` });
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
    let goodsData = null;

    // Estratégia 1: variáveis globais que a Temu injeta
    const globalKeys = ['__INIT_DATA__', '__INITIAL_STATE__', '__NEXT_DATA__', 'rawData', '__DATA__'];
    for (const key of globalKeys) {
      try {
        const val = window[key];
        if (!val) continue;
        const str = typeof val === 'string' ? val : JSON.stringify(val);
        if (str.includes('goods_name') || str.includes('goods_price')) {
          const obj = typeof val === 'string' ? JSON.parse(val) : val;
          // Procurar goods_detail em qualquer nível
          const find = (o, depth = 0) => {
            if (!o || typeof o !== 'object' || depth > 6) return null;
            if (o.goods_name && (o.goods_price !== undefined || o.min_normal_price !== undefined)) return o;
            for (const v of Object.values(o)) {
              const r = find(v, depth + 1);
              if (r) return r;
            }
            return null;
          };
          goodsData = find(obj);
          if (goodsData) break;
        }
      } catch {}
    }

    // Estratégia 2: todos os script tags com JSON
    if (!goodsData) {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const txt = s.textContent || '';
        if (!txt.includes('goods_name')) continue;
        try {
          // Extrair JSON do script (pode ter window.__X__ = {...})
          const match = txt.match(/\{.*"goods_name".*\}/s);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.goods_name) { goodsData = parsed; break; }
          }
        } catch {}
      }
    }

    // --- Extrair campos ---

    // Nome
    const nome =
      goodsData?.goods_name ||
      goodsData?.title ||
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.split('|')[0].trim();

    // Preço
    let preco = 0;
    if (goodsData) {
      const rawPrice = goodsData.min_normal_price ?? goodsData.goods_price ?? goodsData.price ?? goodsData.sale_price;
      preco = parseFloat(String(rawPrice ?? '0').replace(/[^0-9.]/g, '')) || 0;
    }
    if (!preco) {
      // Fallback DOM — procurar o primeiro número decimal visível perto de "€" ou "EUR"
      const priceEls = document.querySelectorAll('[class*="price"],[class*="Price"],[class*="sale"],[class*="Sale"]');
      for (const el of priceEls) {
        const txt = el.textContent || '';
        const m = txt.match(/(\d+[.,]\d{2})/);
        if (m) { preco = parseFloat(m[1].replace(',', '.')); break; }
      }
    }

    // Imagens
    let imagens = [];
    if (goodsData) {
      const imgs =
        goodsData.goods_gallery_imgs ||
        goodsData.images ||
        goodsData.goods_imgs ||
        goodsData.gallery ||
        [];
      imagens = (Array.isArray(imgs) ? imgs : [])
        .map(i => {
          if (typeof i === 'string') return i;
          return i.goods_image_url || i.url || i.thumb_url || i.src || '';
        })
        .filter(u => u && u.startsWith('http'))
        .slice(0, 8);

      // Imagem principal
      if (imagens.length === 0) {
        const main = goodsData.goods_thumb_url || goodsData.main_image || goodsData.cover_image || '';
        if (main) imagens = [main];
      }
    }
    if (imagens.length === 0) {
      // Fallback DOM — imagens grandes (>200px) que não sejam ícones
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || '';
        if (src && src.startsWith('http') && (img.naturalWidth > 200 || img.width > 200) && !imagens.includes(src)) {
          imagens.push(src);
        }
      });
      imagens = imagens.slice(0, 8);
    }

    // Tamanhos e cores
    const tamanhos = [];
    const cores = [];
    const skuProps = goodsData?.sku_props || goodsData?.specs || goodsData?.attributes || goodsData?.sku_list || [];
    if (Array.isArray(skuProps)) {
      skuProps.forEach(prop => {
        const propName = (prop.prop_name || prop.attr_name || prop.name || '').toLowerCase();
        const values = prop.prop_values || prop.values || prop.options || [];
        const isSize = propName.includes('size') || propName.includes('tamanho') || propName.includes('taille');
        const isColor = propName.includes('color') || propName.includes('cor') || propName.includes('couleur');
        (Array.isArray(values) ? values : []).forEach(v => {
          const val = v.prop_value || v.value || v.name || v || '';
          if (typeof val !== 'string') return;
          if (isSize && !tamanhos.includes(val)) tamanhos.push(val);
          if (isColor && !cores.includes(val)) cores.push(val);
        });
      });
    }
    // Fallback DOM para tamanhos
    if (tamanhos.length === 0) {
      document.querySelectorAll('[class*="size"] button, [class*="Size"] button').forEach(btn => {
        const t = btn.textContent?.trim();
        if (t && t.length < 10 && !tamanhos.includes(t)) tamanhos.push(t);
      });
    }

    // Descrição
    const descricao =
      goodsData?.goods_desc ||
      goodsData?.description ||
      goodsData?.detail ||
      document.querySelector('[class*="description"],[class*="Description"]')?.textContent?.trim()?.slice(0, 1000) ||
      '';

    return { nome, preco, descricao, imagens, tamanhos, cores, url: window.location.href, fonte: 'temu' };
  } catch (e) {
    return { nome: document.title.split('|')[0].trim(), preco: 0, descricao: '', imagens: [], tamanhos: [], cores: [], url: window.location.href, fonte: 'temu', erro: e.message };
  }
}
