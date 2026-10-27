export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Users, Phone, Mail, FileText } from 'lucide-react';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Informação da empresa — Real Stiles',
  description: 'Real Stiles Multi Service: intermediação de encomendas e acompanhamento da aquisição à entrega.',
};

export default async function InformacaoEmpresaPage() {
  const config = await getConfigSSR();
  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ');
  const email = config.empresa_email || 'geral@realstiles.co.mz';

  return (
    <>
      <InfoHero
        eyebrow="Conhece quem te acompanha"
        titulo={config.empresa_nome}
        sub="Intermediação de encomendas e acompanhamento da aquisição à entrega."
      />

      <InfoSecao>
        <InfoGrelha colunas={2}>
          <InfoCartao icone={<MapPin size={20} strokeWidth={1.5} />} titulo="A nossa base" href="/entregas" acao="Conhecer as entregas">
            {morada || 'Chimoio · Manica · Moçambique'}. Confirma com a equipa o ponto exato e o agendamento antes de te deslocares.
          </InfoCartao>
          <InfoCartao icone={<Users size={20} strokeWidth={1.5} />} titulo="As pessoas por trás do serviço" href="/quem-somos" acao="Conhecer a equipa">
            Uma equipa próxima para esclarecer características, disponibilidade, pagamento e entrega.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Fala connosco" titulo="Usa os contactos " destaque="oficiais.">
        <InfoGrelha colunas={2}>
          <InfoCartao icone={<Phone size={20} strokeWidth={1.5} />} titulo="Contactos">
            Dúvidas sobre uma compra, uma condição ou uma proposta.
            <span className="info-contactos" style={{ marginTop: 12 }}>
              <a href={`mailto:${email}`}><Mail size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{email}</a>
              <a href={`tel:+258${config.tel1.replace(/\D/g, '')}`}>{config.tel1}</a>
              <a href={`tel:+258${config.tel2.replace(/\D/g, '')}`}>{config.tel2}</a>
            </span>
          </InfoCartao>
          <InfoCartao icone={<FileText size={20} strokeWidth={1.5} />} titulo="Informação para decidir" href="/termos" acao="Consultar termos e condições">
            Consulta as políticas de compras, entregas, devoluções, privacidade e utilização do site.
          </InfoCartao>
        </InfoGrelha>
        {(config.empresa_nif) && (
          <p className="pol-nota" style={{ marginTop: 20 }}>NIF {config.empresa_nif}</p>
        )}
      </InfoSecao>
    </>
  );
}
