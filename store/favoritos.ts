'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritosState {
  ids: string[];
  toggleFavorito: (id: string) => void;
  isFavorito: (id: string) => boolean;
}

export const useFavoritos = create<FavoritosState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggleFavorito: (id) => set(s => ({
        ids: s.ids.includes(id) ? s.ids.filter(i => i !== id) : [...s.ids, id],
      })),
      isFavorito: (id) => get().ids.includes(id),
    }),
    { name: 'cs_favoritos' }
  )
);
