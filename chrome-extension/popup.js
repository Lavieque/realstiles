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

// Função injectada na página Temu — porta a lógica do sidecar
async function extractTemuProduct() {
  const unique = (arr) => [...new Set((arr || []).filter(Boolean))];
  const firstNonEmpty = (...vals) => { for (const v of vals) { if (typeof v === 'string' && v.trim()) return v.trim(); if (v !== null && v !== undefined && v !== '') return v; } return null; };
  const normalizeImg = (v) => { if (!v || typeof v !== 'string') return null; if (v.startsWith('//')) return 'https:' + v; if (v.startsWith('http://')) return 'https://' + v.slice(7); return v; };
  const normalizePrice = (v) => { if (typeof v === 'number') return String(v / 100); if (typeof v === 'string' && v.trim()) return v.trim(); return null; };

  // Extrair goodsId da URL (igual ao sidecar: parseProductUrl)
  const pathMatch = location.pathname.match(/-[pg]-(\d+)/i);
  const goodsId = pathMatch?.[1] || new URLSearchParams(location.search).get('goods_id');

  // ── Estratégia 1: Direct API fetch com sessão do utilizador ──────────────
  let apiResult = null;
  if (goodsId) {
    const endpoints = [
      { url: '/pt/api/bg/bg-nautilus-api/goods/get_goods_detail', body: { goods_id: goodsId, scene: 'goods_detail', language: 'pt-PT' } },
      { url: '/pt/api/poppy/v1/goods',                             body: { goods_id: goodsId, scene: 'goods_detail' } },
      { url: '/pt/api/bg/goods/get_goods_detail',                  body: { goods_id: goodsId } },
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(ep.body) });
        if (!res.ok) continue;
        const payload = await res.json();
        // findCandidateResultObjects — procurar objecto com shape de produto
        const find = (obj, depth = 0, seen = new Set()) => {
          if (!obj || typeof obj !== 'object' || depth > 8 || seen.has(obj)) return [];
          seen.add(obj);
          const matches = [];
          const hasShape = 'price_info' in obj || 'property_list' in obj || 'sku_list' in obj || 'goods_imgs' in obj || 'display_name' in obj || 'goods_name' in obj || ('title' in obj && 'goods_id' in obj);
          if (hasShape) matches.push(obj);
          for (const v of Object.values(obj)) matches.push(...find(v, depth + 1, seen));
          return matches;
        };
        const candidates = find(payload);
        const best = candidates.filter(c => String(c.goods_id || c.goodsId || '') === String(goodsId)).sort((a, b) => {
          const score = (o) => (o.price_info ? 10 : 0) + (o.goods_imgs?.length ? 10 : 0) + (o.property_list?.length ? 10 : 0) + (o.sku_list?.length ? 10 : 0) + (o.display_name || o.goods_name ? 10 : 0);
          return score(b) - score(a);
        })[0];
        if (!best) continue;

        const priceInfo = best.price_info || {};
        const propertyList = Array.isArray(best.property_list) ? best.property_list : [];
        const skuList = Array.isArray(best.sku_list) ? best.sku_list : [];

        const extractPropVals = (list, pattern) => unique(list.filter(p => pattern.test(p?.property_name || p?.spec_name || '')).flatMap(p => (p.sku_property_values || p.value_list || p.attr_value_list || p.values || []).map(v => firstNonEmpty(v?.property_value_name, v?.spec_value, v?.value_name, v?.name, typeof v === 'string' ? v : null))));
        const extractSkuSpecs = (list, pattern) => unique(list.flatMap(s => (s?.specs || s?.prop_list || []).filter(x => pattern.test(x?.spec_name || x?.prop_name || '')).map(x => firstNonEmpty(x?.spec_value, x?.prop_value))));

        const cores = unique([...extractPropVals(propertyList, /color|colour|cor/i), ...(best.color_list || []).map(c => firstNonEmpty(c?.color_name, c?.name)), ...extractSkuSpecs(skuList, /color|colour|cor/i)]);
        const tamanhos = unique([...extractPropVals(propertyList, /size|tamanho|taille|talla/i), ...extractSkuSpecs(skuList, /size|tamanho|taille|talla/i)]);
        const imagens = unique((Array.isArray(best.goods_imgs) ? best.goods_imgs : []).map(i => normalizeImg(typeof i === 'string' ? i : i?.goods_image_url || i?.origin_url || i?.url || i?.img_url || i?.thumb_url))).filter(Boolean);
        const rawPrice = priceInfo.price ?? best.sale_price;

        apiResult = {
          nome: firstNonEmpty(best.display_name, best.goods_name, best.title),
          preco: rawPrice != null ? parseFloat(normalizePrice(rawPrice)) || 0 : 0,
          descricao: firstNonEmpty(best.goods_desc, best.description) || '',
          imagens,
          tamanhos,
          cores,
          url: location.href,
          fonte: 'temu',
        };
        if (apiResult.nome && (apiResult.preco > 0 || apiResult.imagens.length > 0)) break;
        apiResult = null;
      } catch {}
    }
  }
  if (apiResult) return apiResult;

  // ── Estratégia 2: JSON-LD (igual ao sidecar: extractStructuredFallback) ──
  const jsonLdBlocks = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap(s => { try { return [JSON.parse(s.textContent)]; } catch { return []; } });
  const findProductLd = (blocks) => { const q = [...blocks]; while (q.length) { const c = q.shift(); if (!c) continue; if (Array.isArray(c)) { q.push(...c); continue; } if (c['@type'] === 'ProductGroup' || c['@type'] === 'Product') return c; for (const v of Object.values(c)) if (v && typeof v === 'object') q.push(v); } return null; };
  const ldProduct = findProductLd(jsonLdBlocks);
  if (ldProduct) {
    const variants = Array.isArray(ldProduct.hasVariant) ? ldProduct.hasVariant : [];
    const cores = unique([ldProduct.color, ...variants.map(v => v.color)]);
    const tamanhos = unique(variants.map(v => v.size));
    const imagens = unique((ldProduct.image || []).map(normalizeImg)).filter(Boolean);
    const priceRaw = variants[0]?.offers?.price || ldProduct.offers?.price;
    if (ldProduct.name && (priceRaw || imagens.length)) {
      return { nome: ldProduct.name, preco: parseFloat(priceRaw) || 0, descricao: ldProduct.description || '', imagens, tamanhos, cores, url: location.href, fonte: 'temu' };
    }
  }

  // ── Estratégia 3: DOM ────────────────────────────────────────────────────
  const isCdnImg = (src) => typeof src === 'string' && (src.includes('kwcdn.com') || src.includes('temu.com/goods_img') || src.includes('temu.com/img'));
  const sizePattern = /^\s*(?:\d{1,3}(?:[.,]\d)?(?:\s*(?:cm|mm|EU|UK|US))?\s*|XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL)\s*$/i;
  const uiPattern = /botão|button|select|tudo|all|fechar|close|mais|more|less|menos/i;
  const cleanLabel = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/[【】「」《》\[\]]/g, '').trim();

  // Imagens — escopo para contentor da galeria, igual ao sidecar
  const gallerySelectors = ['[class*="gallery"]','[class*="swiper"]','[class*="preview"]','[class*="thumbnail"]','[class*="carousel"]','[class*="main-img"]','[class*="product-img"]','[class*="detail-img"]'];
  let galleryRoot = null;
  for (const sel of gallerySelectors) {
    const el = document.querySelector(sel);
    if (el && el.querySelectorAll('img').length > 1) { galleryRoot = el; break; }
  }
  const imgScope = galleryRoot || document;
  const imagens = unique(Array.from(imgScope.querySelectorAll('img')).flatMap(el =>
    [el.src, el.dataset?.src, (el.getAttribute('srcset') || '').split(',')[0]?.trim().split(' ')[0]]
      .map(normalizeImg).filter(u => u && isCdnImg(u) && !u.includes('_60x60') && !u.includes('_100x100') && !u.includes('_100w'))
  )).slice(0, 20);

  // Cores e tamanhos — procurar por secção com heading "Cor"/"Tamanho"
  const allOptionEls = Array.from(document.querySelectorAll('[role="radio"][aria-label],[role="option"][aria-label],[aria-checked][aria-label]'));

  // Tentar encontrar opções agrupadas por heading Cor/Tamanho
  let coresDOM = [], tamanhosDOM = [];
  const headings = Array.from(document.querySelectorAll('*')).filter(el => {
    const txt = (el.textContent || '').trim().toLowerCase();
    return (txt === 'cor' || txt === 'color' || txt === 'colour' || txt === 'tamanho' || txt === 'size' || txt.startsWith('cor:') || txt.startsWith('tamanho:')) && el.children.length === 0 && txt.length < 20;
  });
  for (const heading of headings) {
    const isCor = /^cor|^color|^colour/i.test(heading.textContent.trim());
    const isTam = /^tamanho|^size/i.test(heading.textContent.trim());
    if (!isCor && !isTam) continue;
    // Procurar options no mesmo bloco pai
    let container = heading.parentElement;
    for (let i = 0; i < 4; i++) {
      const opts = container ? Array.from(container.querySelectorAll('[role="radio"][aria-label],[role="option"][aria-label],[aria-checked][aria-label]')) : [];
      if (opts.length > 0) {
        const vals = unique(opts.map(cleanLabel).filter(v => v.length > 0 && v.length < 40 && !uiPattern.test(v)));
        if (isCor) coresDOM = vals;
        if (isTam) tamanhosDOM = vals;
        break;
      }
      container = container?.parentElement;
    }
  }

  // Fallback: separar por padrão se headings não encontraram nada
  if (coresDOM.length === 0 && tamanhosDOM.length === 0) {
    tamanhosDOM = unique(allOptionEls.map(cleanLabel).filter(v => sizePattern.test(v) && v.length < 20));
    coresDOM = unique(allOptionEls.map(cleanLabel).filter(v => v.length > 0 && v.length < 40 && !sizePattern.test(v) && !uiPattern.test(v)));
  }

  // Preço DOM
  let precoDOM = 0;
  const priceEls = document.querySelectorAll('[class*="price"],[class*="Price"],[class*="sale"],[class*="Sale"]');
  for (const el of priceEls) {
    const m = (el.textContent || '').match(/(\d+[.,]\d{2})/);
    if (m) { precoDOM = parseFloat(m[1].replace(',', '.')); break; }
  }

  const nome = document.querySelector('h1')?.textContent?.trim() || document.title.split('|')[0].trim();
  return { nome, preco: precoDOM, descricao: '', imagens, tamanhos: tamanhosDOM, cores: coresDOM, url: location.href, fonte: 'temu' };
}
