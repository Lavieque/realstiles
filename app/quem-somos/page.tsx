export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Eye, Star, Handshake } from 'lucide-react';
import Image from '@/components/CloudImage';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { membrosEquipa } from '@/lib/config-site';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Quem somos — Real Stiles',
  description: 'A Real Stiles Multi Service é uma empresa de intermediação de encomendas: aproximamos produtos nacionais e internacionais de quem procura uma forma mais simples de comprar.',
};

export default async function QuemSomosPage() {
  const config = await getConfigSSR();
  const membros = membrosEquipa(config);
  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ');

  return (
    <>
      <InfoHero
        eyebrow="Real Stiles Multi Service"
        titulo="Tu tens a escolha. "
        destaque="Nós temos o compromisso."
        sub="Somos uma empresa de intermediação de encomendas. Aproximamos produtos nacionais e internacionais de quem procura uma forma mais simples de comprar."
      >
        <Link href="/loja" className="btn-escuro">Descobrir a coleção <ArrowRight size={16} strokeWidth={1.75} /></Link>
      </InfoHero>

      {membros.length > 0 && (
        <InfoSecao eyebrow="Uma equipa próxima" titulo="Quem cuida " destaque="de cada escolha." sub="Da primeira conversa ao acompanhamento do teu pedido.">
          <div className="qs-equipa-grid">
            {membros.map((m, i) => (
              <div key={i} className="qs-membro">
                <div className="qs-membro-foto">
                  {m.foto ? (
                    <Image src={m.foto} alt={m.nome} fill style={{ objectFit: 'cover' }} sizes="120px" />
                  ) : (
                    <div className="qs-membro-sem-foto">{m.nome.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <h3>{m.nome}</h3>
                {m.cargo && <p className="cargo">{m.cargo}</p>}
                {m.bio && <p className="bio">{m.bio}</p>}
              </div>
            ))}
          </div>
        </InfoSecao>
      )}

      <InfoSecao tom="sand" eyebrow="O nosso propósito" titulo={`${config.qs_sobre_titulo.split('. ')[0]}. `} destaque={config.qs_sobre_titulo.includes('. ') ? config.qs_sobre_titulo.split('. ').slice(1).join('. ') : undefined} sub={[config.qs_sobre_texto1, config.qs_sobre_texto2].filter(Boolean).join(' ')}>
        <InfoGrelha colunas={4}>
          <InfoCartao icone={<Handshake size={20} strokeWidth={1.5} />} titulo="Confiança">Compromisso e atenção em cada compra.</InfoCartao>
          <InfoCartao icone={<Eye size={20} strokeWidth={1.5} />} titulo="Transparência">Informação clara sobre produtos, custos e entrega.</InfoCartao>
          <InfoCartao icone={<Star size={20} strokeWidth={1.5} />} titulo="Qualidade">Uma seleção cuidada para o teu dia a dia.</InfoCartao>
          <InfoCartao icone={<ShieldCheck size={20} strokeWidth={1.5} />} titulo="Proximidade">Uma equipa que acompanha o teu pedido.</InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      {membros.length > 0 && (
        <InfoSecao eyebrow="As pessoas por trás do serviço" titulo="Uma equipa, " destaque="um compromisso.">
          <InfoGrelha colunas={3}>
            {membros.map((m, i) => (
              <InfoCartao key={i} titulo={m.nome}>
                {m.cargo && <><strong>{m.cargo}</strong><br /></>}
                {m.bio}
              </InfoCartao>
            ))}
          </InfoGrelha>
        </InfoSecao>
      )}

      {morada && (
        <InfoSecao tom="sand" eyebrow={config.qs_localizacao_titulo} titulo="De Chimoio para " destaque="todo Moçambique." sub={morada}>
          <div className="qs-localizacao-mapa">
            <iframe
              src={`https://www.google.com/maps?q=${encodeURIComponent(morada)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização"
            />
          </div>
        </InfoSecao>
      )}

      <InfoSecao titulo={`${config.qs_cta_titulo} `}>
        <p className="pol-nota" style={{ marginTop: -8 }}>{config.qs_cta_subtitulo}</p>
        <div className="info-hero-acoes">
          <Link href="/ajuda" className="btn-escuro">Falar com a equipa</Link>
          <a href={`tel:+258${config.tel1.replace(/\D/g, '')}`} className="btn-claro">{config.tel1}</a>
        </div>
      </InfoSecao>
    </>
  );
}
