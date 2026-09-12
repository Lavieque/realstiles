export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getConfigSSR } from '@/lib/config-site-ssr';

export const metadata: Metadata = {
  title: 'Políticas da Loja — Real Stiles',
};

const SECCOES_DEFEITO = [
  { t: '1. Encomendas', c: 'As encomendas são processadas após confirmação do pagamento. O prazo de entrega varia consoante a disponibilidade do produto e a localização do cliente.' },
  { t: '2. Pagamentos', c: 'Aceitamos pagamento por M-Pesa, transferência bancária e dinheiro na entrega (sujeito a disponibilidade). O pagamento deve ser efectuado antes do início do processo de encomenda.' },
  { t: '3. Devoluções', c: 'Aceitamos devoluções no prazo de 7 dias após a entrega, desde que o produto esteja nas mesmas condições em que foi entregue, com embalagem original.' },
  { t: '4. Privacidade', c: 'Os seus dados pessoais são tratados de forma confidencial e apenas utilizados para o processamento das encomendas. Não partilhamos informações com terceiros.' },
  { t: '5. Contacto', c: 'Para qualquer questão, contacte-nos pelo WhatsApp (+258 878 753 754) ou pelo email. Respondemos no prazo de 24 horas úteis.' },
];

export default async function PoliticasPage() {
  const config = await getConfigSSR();
  const paragrafosPersonalizados = config.pol_conteudo.split('\n\n').map(p => p.trim()).filter(Boolean);

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="page-header">
          <h1>{config.pol_titulo}</h1>
          <p>{config.pol_data}</p>
        </div>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 40 }}>
          {paragrafosPersonalizados.length > 0 ? (
            paragrafosPersonalizados.map((p, i) => (
              <p key={i} style={{ color: 'var(--gray-600)', lineHeight: 1.7, marginBottom: 20 }}>{p}</p>
            ))
          ) : (
            SECCOES_DEFEITO.map(s => (
              <div key={s.t} style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{s.t}</h2>
                <p style={{ color: 'var(--gray-600)', lineHeight: 1.7 }}>{s.c}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
