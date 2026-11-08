import { getAdminDb } from '@/lib/firebase-admin';

// Publicações de /noticias, geridas em /admin/noticias (config/noticias.itens)
export interface Noticia {
  id: string;
  tipo?: 'artigo' | 'imprensa';
  categoria?: string;
  titulo: string;
  resumo?: string;
  corpo?: string;
  imagem?: string;
  data?: string;
  link?: string;
}

export async function getNoticias(): Promise<Noticia[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection('config').doc('noticias').get();
    return ((snap.data()?.itens || []) as Noticia[]).filter(n => n.titulo?.trim());
  } catch {
    return [];
  }
}
