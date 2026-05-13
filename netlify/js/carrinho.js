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
