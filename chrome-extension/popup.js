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
      showStatus(temuStatus, '[1/3] A extrair dados...', 'loading');
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractTemuProduct,
      });

      const produto = result?.result;
      if (!produto || !produto.nome) {
        showStatus(temuStatus, 'Sem dados: ' + JSON.stringify(produto).slice(0, 80), 'error');
        btnTemuImport.disabled = false;
        return;
      }
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const postBase = realstilesBase;

      const postRes = await fetch(`${postBase}/api/import/temu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, produto }),
      });

      if (!postRes.ok) throw new Error(`Erro ${postRes.status}`);

      chrome.tabs.create({ url: `${realstilesBase}/admin/importar?temu_token=${token}` });
      // Debug visível após envio com sucesso
      showStatus(temuStatus, `[${produto._estrategia||'?'}] ${produto.imagens?.length||0} imgs · preço: ${produto.preco} · ${produto.cores?.length||0} cores · ${produto.tamanhos?.length||0} tam`, 'success');
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

// Função injectada na página Temu — porta a lógica do sidecar
function extractTemuProduct() {
  const unique = (arr) => [...new Set((arr || []).filter(Boolean))];
  const firstNonEmpty = (...vals) => { for (const v of vals) { if (typeof v === 'string' && v.trim()) return v.trim(); if (v !== null && v !== undefined && v !== '') return v; } return null; };
  const normalizeImg = (v) => { if (!v || typeof v !== 'string') return null; if (v.startsWith('//')) return 'https:' + v; if (v.startsWith('http://')) return 'https://' + v.slice(7); return v.startsWith('https') ? v : null; };
  const normalizePrice = (v) => { if (typeof v === 'number') return v / 100; if (typeof v === 'string' && v.trim()) return parseFloat(v.trim()); return null; };

  const extractPropVals = (list, pat) => unique(list.filter(p => pat.test(p?.property_name || p?.spec_name || '')).flatMap(p => (p.sku_property_values || p.value_list || p.attr_value_list || p.values || []).map(v => firstNonEmpty(v?.property_value_name, v?.spec_value, v?.value_name, v?.name, typeof v === 'string' ? v : null))));
  const extractSkuSpecs = (list, pat) => unique(list.flatMap(s => (s?.specs || s?.prop_list || []).filter(x => pat.test(x?.spec_name || x?.prop_name || '')).map(x => firstNonEmpty(x?.spec_value, x?.prop_value))));
  const extractImgs = (result) => unique((Array.isArray(result.goods_imgs) ? result.goods_imgs : []).map(img => typeof img === 'string' ? normalizeImg(img) : normalizeImg(img?.goods_image_url || img?.origin_url || img?.url || img?.img_url || img?.thumb_url || img?.image_url)).filter(Boolean));

  const fromApiShape = (product, goodsId) => {
    const priceInfo = product.price_info || {};
    const skuList = Array.isArray(product.sku_list) ? product.sku_list : [];
    const propertyList = Array.isArray(product.property_list) ? product.property_list : [];
    const cores = unique([...extractPropVals(propertyList, /color|colour|cor/i), ...(product.color_list || []).map(c => firstNonEmpty(c?.color_name, c?.name)), ...extractSkuSpecs(skuList, /color|colour|cor/i)]);
    const tamanhos = unique([...extractPropVals(propertyList, /size|tamanho|taille|talla/i), ...extractSkuSpecs(skuList, /size|tamanho|taille|talla/i)]);
    const imagens = extractImgs(product);
    const rawPrice = priceInfo.price ?? product.sale_price;
    const nome = firstNonEmpty(product.display_name, product.goods_name, product.title);
    if (!nome && !imagens.length) return null;
    return { nome, preco: normalizePrice(rawPrice) || 0, descricao: firstNonEmpty(product.goods_desc, product.description) || '', imagens, tamanhos, cores, url: location.href, fonte: 'temu' };
  };

  // ── Estratégia 1: __NEXT_DATA__ (SSR — Temu é Next.js) ──────────────────
  try {
    const el = document.querySelector('#__NEXT_DATA__');
    if (el) {
      const nextData = JSON.parse(el.textContent);
      const findProduct = (obj, depth = 0) => {
        if (depth > 8 || !obj || typeof obj !== 'object') return null;
        if (obj.goods_name || obj.display_name || (obj.goods_id && (obj.price_info || obj.sale_price))) return obj;
        for (const val of Object.values(obj)) { const f = findProduct(val, depth + 1); if (f) return f; }
        return null;
      };
      const product = findProduct(nextData);
      if (product) {
        const result = fromApiShape(product);
        if (result) return { ...result, _estrategia: 'next-data' };
      }
    }
  } catch {}

  // ── Estratégia 2: window.__INITIAL_STATE__ / __PRELOADED_STATE__ ─────────
  try {
    for (const key of ['__INITIAL_STATE__', '__PRELOADED_STATE__', 'PAGE_INFO']) {
      const state = window[key];
      if (!state) continue;
      const findProduct = (obj, depth = 0) => {
        if (depth > 8 || !obj || typeof obj !== 'object') return null;
        if (obj.goods_name || obj.display_name || (obj.goods_id && (obj.price_info || obj.sale_price))) return obj;
        for (const val of Object.values(obj)) { const f = findProduct(val, depth + 1); if (f) return f; }
        return null;
      };
      const product = findProduct(state);
      if (product) { const result = fromApiShape(product); if (result) return { ...result, _estrategia: key }; }
    }
  } catch {}

  // ── Estratégia 3: JSON-LD ────────────────────────────────────────────────
  try {
    const blocks = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap(s => { try { return [JSON.parse(s.textContent)]; } catch { return []; } });
    const findLd = (blocks) => { const q = [...blocks]; while (q.length) { const c = q.shift(); if (!c) continue; if (Array.isArray(c)) { q.push(...c); continue; } if (c['@type'] === 'ProductGroup' || c['@type'] === 'Product') return c; for (const v of Object.values(c)) if (v && typeof v === 'object') q.push(v); } return null; };
    const ld = findLd(blocks);
    if (ld && ld.name) {
      const variants = Array.isArray(ld.hasVariant) ? ld.hasVariant : [];
      const priceRaw = variants[0]?.offers?.price || ld.offers?.price || 0;
      const imagens = unique((Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : []).map(normalizeImg)).filter(Boolean);
      if (ld.name && (priceRaw || imagens.length)) {
        return { nome: ld.name, preco: parseFloat(priceRaw) || 0, descricao: ld.description || '', imagens, tamanhos: unique(variants.map(v => v.size).filter(Boolean)), cores: unique([ld.color, ...variants.map(v => v.color)].filter(Boolean)), url: location.href, fonte: 'temu', _estrategia: 'json-ld' };
      }
    }
  } catch {}

  // ── Estratégia 4: DOM ────────────────────────────────────────────────────
  try {
    const isCdnImg = (src) => typeof src === 'string' && src.includes('kwcdn.com') && src.includes('/product/');
    const sizePattern = /^\s*(?:\d{1,3}(?:[.,]\d)?(?:\s*(?:cm|mm|EU|UK|US))?\s*|XXS|XS|S|M|L|XL|X{2,5}L|[2-9]XL)\s*$/i;
    const uiLabelPattern = /botão|button|select|tudo|all|fechar|close|mais|more|less|menos/i;

    // recHeading e isBeforeRec definidos primeiro para poder ser usados em todo o resto
    const recHeading = Array.from(document.querySelectorAll('h2,h3,h4,h5,[class*="section-title"],[class*="section_title"],[class*="module-title"]'))
      .find(h => /explore|interesse|similar|também|recomend|suggest|may also|you may|like|discover|mais artigos/i.test(h.textContent));
    const isBeforeRec = (el) => !recHeading || !!(recHeading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);

    // Preço: procura "13,50€" no texto do DOM antes das recomendações
    let preco = 0;
    try {
      const priceRe = /(\d{1,4}[.,]\d{2})\s*[€$£]/;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode()) && !preco) {
        const txt = node.textContent.trim();
        const m = priceRe.exec(txt);
        if (m && node.parentElement && isBeforeRec(node.parentElement)) {
          const val = parseFloat(m[1].replace(',', '.'));
          if (val > 0 && val < 10000) preco = val;
        }
      }
    } catch {}

    // Cores e tamanhos: aria-label em elementos de opção antes das recomendações
    const allOptionEls = Array.from(document.querySelectorAll('[role="radio"],[role="option"],[aria-checked],[data-e2e*="sku"],[class*="sku-item"],[class*="sku_item"]'))
      .filter(el => isBeforeRec(el) && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-label')));
    const getLabel = (el) => (el.getAttribute('aria-label') || el.getAttribute('data-label') || el.getAttribute('title') || '').replace(/[【】「」《》\[\]]/g, '').trim();
    let cores = unique(allOptionEls.map(getLabel).filter(v => v.length > 0 && v.length < 40 && !sizePattern.test(v) && !uiLabelPattern.test(v)));
    let tamanhos = unique(allOptionEls.map(getLabel).filter(v => sizePattern.test(v) && v.length < 20));

    // Fallback cores: alt de imagens de swatch antes das recomendações
    if (!cores.length) {
      try {
        const swatchImgs = Array.from(document.querySelectorAll('img[alt]')).filter(el => {
          const alt = el.getAttribute('alt')?.trim();
          return alt && alt.length > 0 && alt.length < 40 && !sizePattern.test(alt) && !uiLabelPattern.test(alt) && isBeforeRec(el) && isCdnImg(el.getAttribute('src') || el.getAttribute('data-src') || '');
        });
        if (swatchImgs.length > 0 && swatchImgs.length <= 20) cores = unique(swatchImgs.map(el => el.getAttribute('alt').trim()));
      } catch {}
    }
    const swatchEls = new Set(Array.from(document.querySelectorAll('[role="radio"] img,[role="option"] img,[aria-checked] img')));
    const imagens = unique(Array.from(document.querySelectorAll('img'))
      .filter(el => isBeforeRec(el) && !swatchEls.has(el))
      .flatMap(el => {
        const candidates = [el.getAttribute('src'), el.getAttribute('data-src'), (el.getAttribute('srcset') || '').split(',')[0]?.trim().split(' ')[0]];
        return candidates.map(normalizeImg).filter(u => u && isCdnImg(u));
      })).slice(0, 10);

    const nome = document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*[-|].*$/, '').trim();
    return { nome, preco, descricao: '', imagens, tamanhos, cores, url: location.href, fonte: 'temu', _estrategia: 'dom' };
  } catch {
    const nome = document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*[-|].*$/, '').trim();
    return { nome, preco: 0, descricao: '', imagens: [], tamanhos: [], cores: [], url: location.href, fonte: 'temu', _estrategia: 'dom-err' };
  }
}
