export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getConfigSSR } from '@/lib/config-site-ssr';
import PoliticaLayout from '@/components/PoliticaLayout';

export const metadata: Metadata = {
  title: 'Políticas da Loja — Real Stiles',
};

const SECCOES_DEFEITO = [
  { t: '1. Encomendas', c: 'As encomendas são processadas após confirmação do pagamento. O prazo de entrega varia consoante a disponibilidade do produto e a localização do cliente.' },
  { t: '2. Pagamentos', c: 'Aceitamos pagamento por M-Pesa, transferência bancária e dinheiro na entrega (sujeito a disponibilidade). O pagamento deve ser efectuado antes do início do processo de encomenda.' },
  { id: 'devolucoes', t: '3. Devoluções', c: 'Aceitamos devoluções no prazo de 7 dias após a entrega, desde que o produto esteja nas mesmas condições em que foi entregue, com embalagem original.' },
  { id: 'privacidade', t: '4. Privacidade', c: 'Os seus dados pessoais são tratados de forma confidencial e apenas utilizados para o processamento das encomendas. Não partilhamos informações com terceiros.' },
  { t: '5. Contacto', c: 'Para qualquer questão, contacte-nos pelo WhatsApp (+258 878 753 754) ou pelo email. Respondemos no prazo de 24 horas úteis.' },
];

export default async function PoliticasPage() {
  const config = await getConfigSSR();
  const paragrafos = config.pol_conteudo.split('\n\n').map(p => p.trim()).filter(Boolean);

  return (
    <PoliticaLayout
      activo="politicas"
      titulo={config.pol_titulo}
      data={config.pol_data}
      paragrafos={paragrafos}
      seccoes={SECCOES_DEFEITO}
    />
  );
}
