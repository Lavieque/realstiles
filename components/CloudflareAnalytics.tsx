'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Cloudflare Web Analytics: sem cookies nem identificação de visitantes, por
// isso não depende do banner de cookies. Fica de fora do /admin para a equipa
// não contar como visitas.
export default function CloudflareAnalytics({ token }: { token: string }) {
  const pathname = usePathname();
  if (!token || pathname === '/admin' || pathname?.startsWith('/admin/')) return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
