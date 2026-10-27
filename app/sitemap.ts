import type { MetadataRoute } from 'next';
import { getProdutos } from '@/lib/produtos';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.realstiles.co.mz';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/promocoes`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/quem-somos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/politicas`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/loja`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/entregas`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/ajuda`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/protecao-compras`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/seguranca`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/informacao-empresa`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/parcerias`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/porque-escolher`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/noticias`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/opinioes`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/termos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const { produtos } = await getProdutos({ max: 500, activo: true });
    const produtoRoutes: MetadataRoute.Sitemap = produtos.map(p => ({
      url: `${base}/produto/${p.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    return [...staticRoutes, ...produtoRoutes];
  } catch {
    return staticRoutes;
  }
}
