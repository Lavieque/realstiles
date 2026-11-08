export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getConfigSSR } from '@/lib/config-site-ssr';
import PoliticaLayout from '@/components/PoliticaLayout';
import { documento } from '@/lib/politicas';
import type { IdDocumento } from '@/lib/politicas';

export const metadata: Metadata = {
  title: 'Políticas da Loja — Real Stiles',
  description: 'Compras, devoluções e privacidade: as condições da Real Stiles, explicadas com clareza.',
};

const ABAS: IdDocumento[] = ['compras', 'devolucoes', 'privacidade'];

export default async function PoliticasPage({ searchParams }: { searchParams: { tab?: string } }) {
  if (searchParams.tab === 'termos') redirect('/termos');
  const id = ABAS.find(a => a === searchParams.tab) || 'compras';
  const config = await getConfigSSR();

  return <PoliticaLayout doc={documento(id, config)} data={config.pol_data} />;
}
