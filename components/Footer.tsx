import Link from 'next/link';
import { getConfigSSR } from '@/lib/config-site-ssr';
import MetodoPagamentoLogo from '@/components/MetodoPagamentoLogo';
import { METODOS_PAGAMENTO } from '@/lib/metodos-pagamento';
import { MessageSquarePlus, ChevronUp, Mail, Phone, MapPin, ChevronRight } from 'lucide-react';

// Faixa acima do rodapé. Sem `href` o parceiro aparece sem ligação.
const PARCEIROS: { nome: string; img: string; href?: string; externo?: boolean; legenda?: string; mostraNome?: boolean }[] = [
  { nome: 'Velsadigital', img: '/img/partner-velsadigital.svg', href: 'https://www.velsadigital.com/pt', externo: true, legenda: 'Página oficial', mostraNome: true },
  { nome: 'ML-Transport', img: '/img/partner-ml-transport.jpg' },
  { nome: 'TMT Logistics', img: '/img/partner-tmt-logistics.png', href: '/parcerias', legenda: 'Conhecer a parceria' },
  { nome: 'CityLink', img: '/img/partner-citylink.jpg', href: 'https://citylink.co.mz/', externo: true, legenda: 'Página oficial' },
];

const ICONES_SOCIAIS: Record<string, React.ReactNode> = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1.2" /></>,
  facebook: <path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.94.92-1.94 1.87V12h3.31l-.53 3.47h-2.78v8.38A12 12 0 0 0 24 12Z" />,
  x: <path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.89-7.41L5.58 22H2.43l7.97-9.1L.8 2h6.41l4.42 6.73L18.9 2Zm-1.1 18h1.74L6.25 4H4.38L17.8 20Z" />,
  tiktok: <path d="M15.5 1h3.2c.2 2.8 1.9 4.5 4.3 4.8v3.3c-1.6 0-3.1-.5-4.3-1.4v8.8A7.1 7.1 0 1 1 12.5 9v3.4a3.8 3.8 0 1 0 3 3.7V1Z" />,
  youtube: <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />,
};

const EMAIL_GERAL = 'geral@realstiles.co.mz';

export default async function Footer() {
  const config = await getConfigSSR();
  const tel1Href = `+258${config.tel1.replace(/\D/g, '')}`;
  const tel2Href = `+258${config.tel2.replace(/\D/g, '')}`;
  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ') || 'Chimoio · Manica, Moçambique';

  const sociais = [
    { id: 'instagram', nome: 'Instagram', url: config.social_instagram },
    { id: 'facebook', nome: 'Facebook', url: config.social_facebook },
    { id: 'x', nome: 'X', url: config.social_x },
    { id: 'tiktok', nome: 'TikTok', url: config.social_tiktok },
    { id: 'youtube', nome: 'YouTube', url: config.social_youtube },
  ];
  const temPerfil = sociais.some(s => s.url);

  return (
    <>
    <section className="parceiros-faixa" aria-labelledby="parceiros-titulo">
      <div className="parceiros-faixa-interior">
        <div>
          <span className="parceiros-eyebrow">Os nossos parceiros</span>
          <h2 id="parceiros-titulo">Juntos, vamos <em>mais longe.</em></h2>
        </div>
        <ul>
          {PARCEIROS.map(p => {
            const corpo = (
              <>
                <span className="parceiro-marca">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.img} alt={p.nome} />
                  {p.mostraNome && <span>{p.nome}</span>}
                </span>
                {p.legenda && <span className="parceiro-legenda">{p.legenda} ›</span>}
              </>
            );
            if (!p.href) return <li key={p.nome}><div className="parceiro-cartao">{corpo}</div></li>;
            return (
              <li key={p.nome}>
                {p.externo
                  ? <a className="parceiro-cartao" href={p.href} target="_blank" rel="noopener noreferrer" aria-label={`${p.nome}: ${p.legenda} (abre numa nova janela)`}>{corpo}</a>
                  : <Link className="parceiro-cartao" href={p.href} aria-label={`${p.nome}: ${p.legenda}`}>{corpo}</Link>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>

    <footer>
      <div className="rodape-colunas">
        <div className="rodape-coluna">
          <h4>Conhece-nos melhor</h4>
          <ul>
            <li><Link href="/quem-somos">Sobre a Real Stiles</Link></li>
            <li><Link href="/porque-escolher">Porquê escolher a Real Stiles?</Link></li>
            <li><Link href="/loja">Todos os produtos</Link></li>
            <li><Link href="/loja?mode=mais-vendidos">Produtos mais vendidos</Link></li>
            <li><Link href="/loja?mode=novidades">Novidades</Link></li>
            <li><Link href="/loja?mode=promocoes">Promoções</Link></li>
          </ul>
          <div className="rodape-social">
            <h4>Encontre-nos</h4>
            <div className="rodape-social-icones">
              {sociais.map(s => {
                const icone = <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONES_SOCIAIS[s.id]}</svg>;
                return s.url
                  ? <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.nome} title={s.nome}>{icone}</a>
                  : <span key={s.id} className="sem-ligacao" role="img" aria-label={`${s.nome}: ligação por associar`} title={`${s.nome}: ligação por associar`}>{icone}</span>;
              })}
            </div>
            {!temPerfil && <p className="rodape-nota">Perfis por associar.</p>}
          </div>
        </div>

        <div className="rodape-coluna">
          <h4>Atendimento ao cliente</h4>
          <ul>
            <li><Link href="/ajuda">Ajuda e contacto</Link></li>
            <li><Link href="/politicas?tab=devolucoes">Devoluções e reembolsos</Link></li>
            <li><Link href="/entregas">Informações de entrega</Link></li>
            <li><Link href="/acompanhar">Acompanhar encomenda</Link></li>
            <li><Link href="/reclamacao">Reclamações</Link></li>
          </ul>
          <div className="rodape-pagamentos">
            <h4>Formas de pagamento</h4>
            <div className="footer-pagamentos">
              {METODOS_PAGAMENTO.filter(m => m !== 'cartao').map(m => <span key={m}><MetodoPagamentoLogo metodo={m} altura={30} /></span>)}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span><img src="/img/payment-mastercard.svg" alt="Mastercard" /></span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span><img src="/img/payment-visa.svg" alt="Visa" /></span>
            </div>
          </div>
        </div>

        <div className="rodape-coluna">
          <h4>Ajuda</h4>
          <ul>
            <li><Link href="/ajuda">Perguntas frequentes</Link></li>
            <li><Link href="/politicas">Política de compras</Link></li>
            <li><Link href="/conta">Minha conta</Link></li>
            <li><Link href="/favoritos">Os meus favoritos</Link></li>
            <li><Link href="/entregas?calcular=1">Cálculo de entregas</Link></li>
          </ul>
        </div>

        <div className="rodape-coluna rodape-contacto">
          <h4>Fala connosco</h4>
          <a href={`mailto:${EMAIL_GERAL}`}><Mail size={17} strokeWidth={1.65} /><span>{EMAIL_GERAL}</span></a>
          <a href={`tel:${tel1Href}`}><Phone size={17} strokeWidth={1.65} /><span>{config.tel1}</span></a>
          <a href={`tel:${tel2Href}`}><Phone size={17} strokeWidth={1.65} /><span>{config.tel2}</span></a>
          <p className="rodape-local"><MapPin size={17} strokeWidth={1.65} /><span>{morada}</span></p>
          <Link href="/ajuda" className="rodape-cta">Pedir apoio <ChevronRight size={16} /></Link>
          <div className="rodape-atalhos">
            <Link href="/ajuda#mensagem"><MessageSquarePlus size={25} strokeWidth={1.8} />Feedback</Link>
            <a href="#"><ChevronUp size={25} strokeWidth={1.8} />Início</a>
          </div>
        </div>
      </div>

      <div className="rodape-fundo">
        <span>{config.copyright}</span>
        <nav className="rodape-legal" aria-label="Documentos legais">
          <Link href="/termos">Termos e condições</Link>
          <Link href="/politicas?tab=privacidade">Política de privacidade</Link>
          <Link href="/politicas?tab=devolucoes">Devoluções e reembolsos</Link>
        </nav>
      </div>
    </footer>
    </>
  );
}
