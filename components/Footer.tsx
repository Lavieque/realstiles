import Link from 'next/link';
import Image from 'next/image';
import { getConfigSSR } from '@/lib/config-site-ssr';
import MetodoPagamentoLogo from '@/components/MetodoPagamentoLogo';
import { METODOS_PAGAMENTO } from '@/lib/metodos-pagamento';

// Faixa acima do rodapé. Sem `href` o parceiro aparece sem ligação.
const PARCEIROS: { nome: string; img: string; href?: string; externo?: boolean; legenda?: string; mostraNome?: boolean }[] = [
  { nome: 'Velsadigital', img: '/img/partner-velsadigital.svg', href: 'https://www.velsadigital.com/pt', externo: true, legenda: 'Página oficial', mostraNome: true },
  { nome: 'ML-Transport', img: '/img/partner-ml-transport.jpg' },
  { nome: 'TMT Logistics', img: '/img/partner-tmt-logistics.png', href: '/parcerias', legenda: 'Conhecer a parceria' },
  { nome: 'CityLink', img: '/img/partner-citylink.jpg', href: 'https://citylink.co.mz/', externo: true, legenda: 'Página oficial' },
];

export default async function Footer() {
  const config = await getConfigSSR();
  const tel1Href = `+258${config.tel1.replace(/\D/g, '')}`;
  const tel2Href = `+258${config.tel2.replace(/\D/g, '')}`;
  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ');

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
      <div className="footer-grid">
        <div className="footer-logo">
          <Image src="/img/logo.png" alt="" height={56} width={56} style={{ height: 56, width: 56, marginBottom: 12 }} />
          <p className="footer-marca">Real <em>Stiles</em></p>
          <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>{config.footer_descricao}</p>
          {morada && <p className="footer-endereco">{morada}</p>}
        </div>
        <div>
          <h4>Conhece-nos</h4>
          <ul>
            <li><Link href="/quem-somos">Quem somos</Link></li>
            <li><Link href="/porque-escolher">Porquê escolher a Real Stiles?</Link></li>
            <li><Link href="/informacao-empresa">Informação da empresa</Link></li>
            <li><Link href="/parcerias">Parcerias</Link></li>
            <li><Link href="/noticias">Notícias</Link></li>
            <li><Link href="/opinioes">Opiniões dos clientes</Link></li>
          </ul>
        </div>
        <div>
          <h4>Atendimento</h4>
          <ul>
            <li><Link href="/ajuda">Ajuda e contacto</Link></li>
            <li><Link href="/entregas">Entregas</Link></li>
            <li><Link href="/acompanhar">Acompanhar encomenda</Link></li>
            <li><Link href="/protecao-compras">Proteção de compras</Link></li>
            <li><Link href="/seguranca">Centro de segurança</Link></li>
            <li><Link href="/reclamacao">Reclamações</Link></li>
            <li><Link href="/politicas">Políticas</Link></li>
            <li><Link href="/termos">Termos e condições</Link></li>
          </ul>
        </div>
        <div>
          <h4>A minha conta</h4>
          <ul>
            <li><Link href="/conta">A minha conta</Link></li>
            <li><Link href="/encomendas">Encomendas</Link></li>
            <li><Link href="/favoritos">Favoritos</Link></li>
            <li><Link href="/carrinho">Carrinho</Link></li>
          </ul>
        </div>
        <div>
          <h4>Fala connosco</h4>
          <ul>
            <li><a href={`tel:${tel1Href}`}>{config.tel1}</a></li>
            <li><a href={`tel:${tel2Href}`}>{config.tel2}</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-extra">
        <div>
          <h4>Formas de pagamento</h4>
          <div className="footer-pagamentos">
            {METODOS_PAGAMENTO.filter(m => m !== 'cartao').map(m => <span key={m}><MetodoPagamentoLogo metodo={m} altura={30} /></span>)}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span><img src="/img/payment-mastercard.svg" alt="Mastercard" style={{ height: 30, width: 'auto' }} /></span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span><img src="/img/payment-visa.svg" alt="Visa" style={{ height: 30, width: 'auto' }} /></span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>{config.copyright}</span>
        <span>
          by{' '}
          <a href="https://velsadigital.com" target="_blank" rel="noopener noreferrer">
            Velsa Digital
          </a>
        </span>
        <span>{config.slogan}</span>
      </div>
    </footer>
    </>
  );
}
