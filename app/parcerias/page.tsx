export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { Handshake, Truck, Mail } from 'lucide-react';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha, InfoAjuda } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Parcerias — Real Stiles',
  description: 'Fornecedores e operadores de logística: apresenta a tua proposta à Real Stiles.',
};

export default async function ParceriasPage() {
  const config = await getConfigSSR();
  const email = config.empresa_email || 'geral@realstiles.co.mz';
  const mailto = (assunto: string) => `mailto:${email}?subject=${encodeURIComponent(assunto)}`;

  return (
    <>
      <InfoHero
        eyebrow="Juntos, mais perto"
        titulo="Boas ligações. "
        destaque="Melhores experiências."
        sub="A Real Stiles aproxima produtos, pessoas e serviços para acompanhar cada encomenda."
      >
        <Link href="/entregas" className="btn-escuro">Conhecer a operação de entrega</Link>
      </InfoHero>

      <InfoSecao eyebrow="Parceiros de entrega" titulo="Unidos no " destaque="caminho até ti." sub="A Real Stiles trabalha com a CityLink e a TMT Logistics para acompanhar o transporte e a entrega. A cobertura, a modalidade e os custos são confirmados com cada pedido.">
        <div className="parceiros-entrega">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href="https://citylink.co.mz/" target="_blank" rel="noopener noreferrer"><img src="/img/partner-citylink.jpg" alt="CityLink" /><span>Página oficial ›</span></a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div><img src="/img/partner-tmt-logistics.png" alt="TMT Logistics" /></div>
        </div>
      </InfoSecao>

      <InfoSecao eyebrow="Trabalha connosco" titulo="Apresenta a tua " destaque="proposta.">
        <InfoGrelha colunas={2}>
          <InfoCartao icone={<Handshake size={20} strokeWidth={1.5} />} titulo="Parcerias comerciais e fornecedores">
            Tens uma proposta de produtos ou serviços? Apresenta a tua empresa, a oferta e os contactos.
            <br /><a className="info-cartao-link" href={mailto('Proposta de parceria')}>Apresentar uma proposta →</a>
          </InfoCartao>
          <InfoCartao icone={<Truck size={20} strokeWidth={1.5} />} titulo="Serviços de logística">
            Partilha a cobertura, as modalidades de transporte e as condições do teu serviço. A equipa analisa cada proposta.
            <br /><a className="info-cartao-link" href={mailto('Serviços de logística')}>Falar sobre logística →</a>
          </InfoCartao>
        </InfoGrelha>
        <p className="pol-nota" style={{ marginTop: 24 }}>
          <Mail size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
          Também podes enviar uma proposta para <a href={`mailto:${email}`} style={{ color: 'var(--black)', fontWeight: 600 }}>{email}</a>.
        </p>
      </InfoSecao>

      <InfoAjuda />
    </>
  );
}
