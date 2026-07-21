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

      // Gerar token e abrir tab Realstiles
      showStatus(temuStatus, '[2/3] A preparar...', 'loading');
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const postBase = realstilesBase;
      const openedNewTab = true;

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
    const isCdnImg = (src) => typeof src === 'string' && (src.includes('kwcdn.com') || src.includes('temu.com/goods_img'));
    // Temu usa query param w=N ou /w/N — thumbnails têm w<=200, imagens principais w>=600
    const imgWidth = (src) => { const m = src.match(/[?&/]w[/=](\d+)/); return m ? parseInt(m[1]) : 9999; };
    const isMainImg = (src) => isCdnImg(src) && imgWidth(src) >= 400;
    const uiPattern = /botão|button|select|tudo|all|fechar|close|mais|more|less|menos|adicionar|add/i;
    const cleanLabel = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim() || '').replace(/[【】「」《》\[\]]/g, '').trim();

    // Imagens — galeria principal, filtrar por largura >= 400px no URL
    const gallerySelectors = ['[class*="swiper-wrapper"]','[class*="gallery"]','[class*="preview"]','[class*="carousel"]','[class*="main-img"]','[class*="product-img"]','[class*="goods-img"]'];
    let imagens = [];
    for (const sel of gallerySelectors) {
      const container = document.querySelector(sel);
      if (!container) continue;
      const imgs = unique(Array.from(container.querySelectorAll('img')).flatMap(el =>
        [el.src, el.dataset?.src, el.dataset?.lazySrc, el.getAttribute('data-original')].map(normalizeImg).filter(s => s && isMainImg(s))
      ));
      if (imgs.length > 0) { imagens = imgs.slice(0, 12); break; }
    }
    // Fallback sem filtro de largura: primeiras imagens CDN da página
    if (!imagens.length) {
      imagens = unique(Array.from(document.querySelectorAll('img')).slice(0, 40).flatMap(el =>
        [el.src, el.dataset?.src].map(normalizeImg).filter(s => s && isCdnImg(s))
      )).slice(0, 12);
    }

    // Preço — procurar dentro do contentor do h1 primeiro, depois toda a página
    let preco = 0;
    const h1El = document.querySelector('h1');
    const priceScope = h1El?.closest('section,main,[class*="detail"],[class*="product"],[class*="info"]') || document.body;
    for (const el of priceScope.querySelectorAll('*')) {
      const txt = el.textContent || '';
      if (el.children.length > 2) continue; // ignorar contentor com muitos filhos
      const m = txt.match(/€\s*(\d+[.,]\d{2})|(\d+[.,]\d{2})\s*€/);
      if (m) { preco = parseFloat((m[1] || m[2]).replace(',', '.')); break; }
    }
    // Fallback: qualquer número decimal na área de preço
    if (!preco) {
      for (const el of priceScope.querySelectorAll('[class*="price"],[class*="Price"],[class*="sale"],[class*="amount"]')) {
        const m = (el.textContent || '').match(/(\d+[.,]\d{2})/);
        if (m) { preco = parseFloat(m[1].replace(',', '.')); break; }
      }
    }

    // Cores e tamanhos — distinguir por estrutura:
    // Cores = opções que têm <img> dentro (swatches de cor)
    // Tamanhos = opções de texto puro
    const allOpts = Array.from(document.querySelectorAll('[role="radio"],[role="option"]'));
    const corOpts = allOpts.filter(el => el.querySelector('img'));
    const tamOpts = allOpts.filter(el => !el.querySelector('img'));

    const cores = unique(corOpts.map(el => (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim())
      .filter(v => v.length > 0 && v.length < 50 && !uiPattern.test(v)));
    const tamanhos = unique(tamOpts.map(el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim() || '').trim())
      .filter(v => v.length > 0 && v.length < 30 && !uiPattern.test(v)));

    const nome = document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*[-|].*$/, '').trim();
    return { nome, preco, descricao: '', imagens, tamanhos, cores, url: location.href, fonte: 'temu' };
  } catch (e) {
    const nome = document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*[-|].*$/, '').trim();
    return { nome, preco: 0, descricao: '', imagens: [], tamanhos: [], cores: [], url: location.href, fonte: 'temu' };
  }
}
