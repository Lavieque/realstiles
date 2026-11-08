export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getConfigSSR } from '@/lib/config-site-ssr';
import PoliticaLayout from '@/components/PoliticaLayout';
import { documento } from '@/lib/politicas';

export const metadata: Metadata = {
  title: 'Termos e Condições — Real Stiles',
};

export default async function TermosPage() {
  const config = await getConfigSSR();

  return <PoliticaLayout doc={documento('termos', config)} data={config.termos_data} />;
}
