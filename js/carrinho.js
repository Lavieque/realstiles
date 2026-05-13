// ── CARRINHO.JS ──
// Carrinho guardado em localStorage

const KEY = 'cs_carrinho';

export function getCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch { return []; }
}

function salvarCarrinho(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  actualizarContador();
  window.dispatchEvent(new CustomEvent('carritoUpdated'));
}

export function adicionarItem(produto, tamanho, cor, quantidade = 1) {
  const carrinho = getCarrinho();
  const key = `${produto.id}_${tamanho}_${cor}`;
  const idx = carrinho.findIndex(i => i.key === key);

  if (idx >= 0) {
    carrinho[idx].quantidade += quantidade;
  } else {
    carrinho.push({
      key,
      produto_id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: produto.imagens?.[0] || '',
      tamanho,
      cor,
      quantidade
    });
  }
  salvarCarrinho(carrinho);
  mostrarToast(`"${produto.nome}" adicionado ao carrinho!`, 'success');
}

export function removerItem(key) {
  const carrinho = getCarrinho().filter(i => i.key !== key);
  salvarCarrinho(carrinho);
}

export function actualizarQuantidade(key, quantidade) {
  const carrinho = getCarrinho();
  const idx = carrinho.findIndex(i => i.key === key);
  if (idx >= 0) {
    if (quantidade <= 0) {
      carrinho.splice(idx, 1);
    } else {
      carrinho[idx].quantidade = quantidade;
    }
    salvarCarrinho(carrinho);
  }
}

export function limparCarrinho() {
  localStorage.removeItem(KEY);
  actualizarContador();
}

export function getTotalItems() {
  return getCarrinho().reduce((sum, i) => sum + i.quantidade, 0);
}

export function getTotalPreco() {
  return getCarrinho().reduce((sum, i) => sum + (i.preco * i.quantidade), 0);
}

export function actualizarContador() {
  const count = getTotalItems();
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ── TOAST ──
export function mostrarToast(msg, tipo = '') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = tipo ? `show ${tipo}` : 'show';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── CART DRAWER ──
export function initCarrinhoDrawer() {
  // Injectar HTML do drawer se ainda não existir
  if (document.getElementById('cart-drawer')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="cart-overlay" id="cart-overlay" onclick="window._fecharDrawer()"></div>
    <div class="cart-drawer" id="cart-drawer">
      <div class="cart-drawer-header">
        <h3>O meu carrinho <span id="cd-header-count" style="color:var(--gray-400);font-weight:400;font-size:14px;"></span></h3>
        <button class="cart-drawer-close" onclick="window._fecharDrawer()">✕</button>
      </div>
      <div class="cart-drawer-items" id="cd-items"></div>
      <div class="cart-drawer-footer" id="cd-footer"></div>
    </div>
  `);

  // Substituir comportamento do botão do carrinho na nav
  document.querySelectorAll('.nav-cart-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      abrirDrawer();
    });
  });

  window._fecharDrawer = fecharDrawer;

  // Actualizar drawer quando o carrinho muda
  window.addEventListener('carritoUpdated', () => {
    if (document.getElementById('cart-drawer').classList.contains('open')) {
      renderDrawer();
    }
  });
}

export function abrirCarrinhoDrawer() {
  abrirDrawer();
}

function abrirDrawer() {
  renderDrawer();
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderDrawer() {
  const carrinho = getCarrinho();
  const total = getTotalPreco();
  const count = getTotalItems();

  document.getElementById('cd-header-count').textContent = count > 0 ? `(${count})` : '';

  const itemsEl = document.getElementById('cd-items');
  const footerEl = document.getElementById('cd-footer');

  if (carrinho.length === 0) {
    itemsEl.innerHTML = `
      <div class="cd-empty">
        <div class="icon">🛍️</div>
        <p>O teu carrinho está vazio</p>
      </div>`;
    footerEl.innerHTML = `
      <a href="index.html" class="btn btn-primary btn-full">Ver produtos</a>`;
    return;
  }

  itemsEl.innerHTML = carrinho.map(item => `
    <div class="cd-item">
      <img class="cd-item-img" src="${item.imagem || 'https://via.placeholder.com/64x80?text=?'}"
        alt="${item.nome}" onerror="this.src='https://via.placeholder.com/64x80?text=?'"/>
      <div class="cd-item-info">
        <div class="cd-item-nome">${item.nome}</div>
        <div class="cd-item-meta">
          ${item.tamanho ? `<span>Tam: ${item.tamanho}</span>` : ''}
          ${item.cor ? `<span>Cor: ${item.cor}</span>` : ''}
        </div>
        <div class="cd-item-preco">${(item.preco * item.quantidade).toFixed(2)} MZN</div>
        <div class="cd-item-qty">
          <button onclick="window._cdQty('${item.key}', ${item.quantidade - 1})">−</button>
          <span>${item.quantidade}</span>
          <button onclick="window._cdQty('${item.key}', ${item.quantidade + 1})">+</button>
        </div>
      </div>
      <button class="cd-item-remove" onclick="window._cdRemove('${item.key}')" title="Remover">✕</button>
    </div>
  `).join('');

  footerEl.innerHTML = `
    <div class="cd-total-row">
      <span>Total</span>
      <strong>${total.toFixed(2)} MZN</strong>
    </div>
    <a href="carrinho.html" class="btn btn-primary btn-full">Ir para o checkout →</a>
    <button onclick="window._fecharDrawer()" class="btn btn-outline btn-full" style="margin-top:8px;">
      Continuar a comprar
    </button>`;

  window._cdQty = (key, qty) => { actualizarQuantidade(key, qty); renderDrawer(); };
  window._cdRemove = (key) => { removerItem(key); renderDrawer(); };
}

// ── RENDER CARRINHO ──
export function renderCarrinho(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const carrinho = getCarrinho();

  if (carrinho.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🛍️</div>
        <h3>O teu carrinho está vazio</h3>
        <p>Adiciona produtos para começar</p>
        <a href="index.html" class="btn btn-primary" style="margin-top:20px">Ver produtos</a>
      </div>`;
    return;
  }

  container.innerHTML = carrinho.map(item => `
    <div class="carrinho-item" data-key="${item.key}">
      <img src="${item.imagem || 'https://via.placeholder.com/80x100'}" alt="${item.nome}"/>
      <div class="ci-info">
        <p class="ci-nome">${item.nome}</p>
        <p class="ci-detalhe">${item.tamanho ? `Tam: ${item.tamanho}` : ''} ${item.cor ? `· Cor: ${item.cor}` : ''}</p>
        <p class="ci-preco">${(item.preco * item.quantidade).toFixed(2)} MZN</p>
      </div>
      <div class="ci-qty">
        <button onclick="window.changeQty('${item.key}', ${item.quantidade - 1})">−</button>
        <span>${item.quantidade}</span>
        <button onclick="window.changeQty('${item.key}', ${item.quantidade + 1})">+</button>
      </div>
      <button class="ci-remove" onclick="window.removeItem('${item.key}')">✕</button>
    </div>
  `).join('');

  window.changeQty = (key, qty) => { actualizarQuantidade(key, qty); renderCarrinho(containerId); };
  window.removeItem = (key) => { removerItem(key); renderCarrinho(containerId); };
}
