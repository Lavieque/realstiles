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

      // Ler token de QUALQUER tab que tenha rs_temu_token em localStorage
      showStatus(temuStatus, '[2/3] A procurar tab Realstiles...', 'loading');
      const allTabs = await chrome.tabs.query({});
      let token = null;
      let postBase = realstilesBase;
      for (const t of allTabs) {
        if (!t.url || t.url.startsWith('chrome') || t.url.startsWith('about') || t.url.startsWith('edge')) continue;
        try {
          const [tokenResult] = await chrome.scripting.executeScript({
            target: { tabId: t.id },
            func: () => localStorage.getItem('rs_temu_token'),
          });
          if (tokenResult?.result) {
            token = tokenResult.result;
            try { postBase = new URL(t.url).origin; } catch {}
            break;
          }
        } catch { /* tab restrita ou sem permissão */ }
      }

      let openedNewTab = false;
      if (!token) {
        token = Math.random().toString(36).slice(2) + Date.now().toString(36);
        openedNewTab = true;
      }

      // Enviar dados para o Realstiles
      showStatus(temuStatus, '[3/3] A enviar para ' + postBase + '...', 'loading');
      const postRes = await fetch(`${postBase}/api/import/temu`, {
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

// Função injectada na página Temu — síncrona, sem fetch, sem risco de travar
function extractTemuProduct() {
  try {
    const unique = (arr) => [...new Set((arr || []).filter(Boolean))];
    const normalizeImg = (v) => { if (!v || typeof v !== 'string') return null; if (v.startsWith('//')) return 'https:' + v; return v.startsWith('http') ? v : null; };

    // ── JSON-LD ──────────────────────────────────────────────────────────────
    const jsonLdBlocks = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .flatMap(s => { try { return [JSON.parse(s.textContent)]; } catch { return []; } });
    const findLd = (blocks) => { const q = [...blocks]; while (q.length) { const c = q.shift(); if (!c) continue; if (Array.isArray(c)) { q.push(...c); continue; } if (c['@type'] === 'ProductGroup' || c['@type'] === 'Product') return c; for (const v of Object.values(c)) if (v && typeof v === 'object') q.push(v); } return null; };
    const ld = findLd(jsonLdBlocks);
    if (ld && ld.name) {
      const variants = Array.isArray(ld.hasVariant) ? ld.hasVariant : [];
      const priceRaw = variants[0]?.offers?.price || ld.offers?.price || 0;
      const imagens = unique((Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : []).map(normalizeImg)).filter(Boolean);
      return {
        nome: ld.name,
        preco: parseFloat(priceRaw) || 0,
        descricao: ld.description || '',
        imagens,
        tamanhos: unique(variants.map(v => v.size).filter(Boolean)),
        cores: unique([ld.color, ...variants.map(v => v.color)].filter(Boolean)),
        url: location.href,
        fonte: 'temu',
      };
    }

    // ── DOM ──────────────────────────────────────────────────────────────────
    const isCdnImg = (src) => typeof src === 'string' && (src.includes('kwcdn.com') || src.includes('temu.com/goods_img') || src.includes('temu.com/img'));
    const sizePattern = /^\s*(?:\d{1,3}(?:[.,]\d)?(?:\s*(?:cm|mm|EU|UK|US))?\s*|XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL)\s*$/i;
    const uiPattern = /botão|button|select|tudo|all|fechar|close|mais|more|less|menos/i;
    const cleanLabel = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/[【】「」《》\[\]]/g, '').trim();

    // Imagens — galeria do produto
    const gallerySelectors = ['[class*="gallery"]','[class*="swiper"]','[class*="preview"]','[class*="thumbnail"]','[class*="carousel"]','[class*="main-img"]','[class*="product-img"]'];
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

    // Cores e tamanhos por heading
    const allOpts = Array.from(document.querySelectorAll('[role="radio"][aria-label],[role="option"][aria-label],[aria-checked][aria-label]'));
    let cores = [], tamanhos = [];
    const headings = Array.from(document.querySelectorAll('*')).filter(el => {
      const txt = (el.textContent || '').trim().toLowerCase();
      return (txt === 'cor' || txt === 'color' || txt === 'tamanho' || txt === 'size' || txt.startsWith('cor:') || txt.startsWith('tamanho:')) && el.children.length === 0 && txt.length < 20;
    });
    for (const h of headings) {
      const isCor = /^cor|^color/i.test(h.textContent.trim());
      const isTam = /^tamanho|^size/i.test(h.textContent.trim());
      let container = h.parentElement;
      for (let i = 0; i < 4; i++) {
        const opts = container ? Array.from(container.querySelectorAll('[role="radio"][aria-label],[role="option"][aria-label],[aria-checked][aria-label]')) : [];
        if (opts.length > 0) {
          const vals = unique(opts.map(cleanLabel).filter(v => v.length > 0 && v.length < 40 && !uiPattern.test(v)));
          if (isCor) cores = vals;
          if (isTam) tamanhos = vals;
          break;
        }
        container = container?.parentElement;
      }
    }
    if (!cores.length && !tamanhos.length) {
      tamanhos = unique(allOpts.map(cleanLabel).filter(v => sizePattern.test(v) && v.length < 20));
      cores = unique(allOpts.map(cleanLabel).filter(v => v.length > 0 && v.length < 40 && !sizePattern.test(v) && !uiPattern.test(v)));
    }

    // Preço
    let preco = 0;
    for (const el of document.querySelectorAll('[class*="price"],[class*="Price"],[class*="sale"],[class*="Sale"]')) {
      const m = (el.textContent || '').match(/(\d+[.,]\d{2})/);
      if (m) { preco = parseFloat(m[1].replace(',', '.')); break; }
    }

    const nome = document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*[-|].*$/, '').trim();
    return { nome, preco, descricao: '', imagens, tamanhos, cores, url: location.href, fonte: 'temu' };
  } catch (e) {
    const nome = document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*[-|].*$/, '').trim();
    return { nome, preco: 0, descricao: '', imagens: [], tamanhos: [], cores: [], url: location.href, fonte: 'temu' };
  }
}
