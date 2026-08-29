'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ItemCarrinho {
  key: string;
  produto_id: string;
  nome: string;
  preco: number;
  imagem: string;
  tamanho: string;
  cor: string;
  quantidade: number;
  stock: number;
  url_origem: string;
}

interface CarrinhoState {
  items: ItemCarrinho[];
  drawerOpen: boolean;
  bumped: boolean;
  adicionarItem: (produto: { id: string; nome: string; preco: number; imagens?: string[]; url_origem?: string }, tamanho: string, cor: string, quantidade?: number) => void;
  removerItem: (key: string) => void;
  actualizarQuantidade: (key: string, quantidade: number) => void;
  limpar: () => void;
  abrirDrawer: () => void;
  fecharDrawer: () => void;
}

export const useCarrinho = create<CarrinhoState>()(
  persist(
    (set, get) => ({
      items: [],
      drawerOpen: false,
      bumped: false,

      adicionarItem: (produto, tamanho, cor, quantidade = 1) => {
        const key = `${produto.id}_${tamanho}_${cor}`;
        const items = get().items;
        const idx = items.findIndex(i => i.key === key);
        const stockMax = (produto as any).stock ?? 99;
        if (idx >= 0) {
          const updated = [...items];
          const novaQty = Math.min(stockMax, updated[idx].quantidade + quantidade);
          updated[idx] = { ...updated[idx], quantidade: novaQty };
          set({ items: updated });
        } else {
          set({
            items: [...items, {
              key,
              produto_id: produto.id,
              nome: produto.nome,
              preco: produto.preco,
              imagem: produto.imagens?.[0] || '',
              tamanho, cor, quantidade,
              stock: stockMax,
              url_origem: produto.url_origem || '',
            }],
          });
        }
        set({ bumped: true });
        setTimeout(() => set({ bumped: false }), 500);
      },

      removerItem: (key) => set(s => ({ items: s.items.filter(i => i.key !== key) })),

      actualizarQuantidade: (key, quantidade) => set(s => ({
        items: quantidade <= 0
          ? s.items.filter(i => i.key !== key)
          : s.items.map(i => i.key === key ? { ...i, quantidade } : i),
      })),

      limpar: () => set({ items: [] }),
      abrirDrawer: () => set({ drawerOpen: true }),
      fecharDrawer: () => set({ drawerOpen: false }),
    }),
    { name: 'cs_carrinho', partialize: (s) => ({ items: s.items }) }
  )
);

export const getTotalItems  = (items: ItemCarrinho[]) => items.reduce((s, i) => s + i.quantidade, 0);
export const getTotalPreco  = (items: ItemCarrinho[]) => items.reduce((s, i) => s + i.preco * i.quantidade, 0);
