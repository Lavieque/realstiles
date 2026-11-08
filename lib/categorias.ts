// Árvore de categorias (3 níveis) e utilitários puros. Campos novos são todos
// opcionais e aditivos: o site de produção ignora-os.

export interface CatNo {
  nome: string;
  slug: string;
  // URL da imagem da categoria (Cloudinary)
  imagem?: string;
  // Chave de ICONES_CATEGORIA (lib/categorias-icones.ts)
  icone?: string;
  subcategorias?: CatNo[];
}

export interface CatInfo {
  nome: string;
  slug: string;
  imagem?: string;
  icone?: string;
  // Slugs do topo até esta categoria (inclusive)
  caminho: string[];
}

// Mapa slug -> info. Em slugs repetidos (ex.: "camisas" em Mulher e Homem)
// fica o primeiro encontrado.
export function indexarCategorias(arvore: CatNo[]): Record<string, CatInfo> {
  const out: Record<string, CatInfo> = {};
  const visitar = (nos: CatNo[], pai: string[]) => {
    for (const n of nos) {
      const caminho = [...pai, n.slug];
      if (!out[n.slug]) out[n.slug] = { nome: n.nome, slug: n.slug, imagem: n.imagem, icone: n.icone, caminho };
      if (n.subcategorias?.length) visitar(n.subcategorias, caminho);
    }
  };
  visitar(arvore, []);
  return out;
}

// Caminho de slugs [categoria, subcategoria, sub-subcategoria] de um artigo.
// Usa o caminho guardado se ainda for válido; senão procura pelo slug.
export function caminhoDoArtigo(arvore: CatNo[], categoria?: string, caminhoGuardado?: string[]): string[] {
  if (!categoria) return [];
  if (caminhoGuardado?.length && caminhoGuardado[caminhoGuardado.length - 1] === categoria) {
    let nos = arvore;
    let valido = true;
    for (const s of caminhoGuardado) {
      const n = nos.find(x => x.slug === s);
      if (!n) { valido = false; break; }
      nos = n.subcategorias || [];
    }
    if (valido) return caminhoGuardado;
  }
  return indexarCategorias(arvore)[categoria]?.caminho ?? [];
}

// Normaliza a árvore vinda da BD (garante arrays em todos os níveis)
export function normalizarArvore(raw: unknown): CatNo[] {
  if (!Array.isArray(raw)) return [];
  const norm = (n: CatNo): CatNo => ({
    ...n,
    subcategorias: (n.subcategorias || []).map(norm),
  });
  return raw.filter((c): c is CatNo => typeof c === 'object' && c !== null).map(norm);
}

// Primeiro nó com este slug (em qualquer nível)
export function acharNo(arvore: CatNo[], slug: string): CatNo | null {
  for (const n of arvore) {
    if (n.slug === slug) return n;
    const dentro = acharNo(n.subcategorias || [], slug);
    if (dentro) return dentro;
  }
  return null;
}

// Slug do nó e de todos os descendentes
export function slugsDaSubarvore(no: CatNo): string[] {
  return [no.slug, ...(no.subcategorias || []).flatMap(slugsDaSubarvore)];
}
