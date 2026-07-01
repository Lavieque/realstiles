import type { MetadataRoute } from 'next';
import { getProdutos } from '@/lib/produtos';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://realstiles.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/promocoes`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/quem-somos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/politicas`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const produtos = await getProdutos({ max: 500, activo: true });
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
