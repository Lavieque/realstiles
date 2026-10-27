import Link from 'next/link';
import Image from 'next/image';
import { getConfigSSR } from '@/lib/config-site-ssr';
import MetodoPagamentoLogo from '@/components/MetodoPagamentoLogo';
import { METODOS_PAGAMENTO } from '@/lib/metodos-pagamento';

export default async function Footer() {
  const config = await getConfigSSR();
  const tel1Href = `+258${config.tel1.replace(/\D/g, '')}`;
  const tel2Href = `+258${config.tel2.replace(/\D/g, '')}`;
  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ');

  return (
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
          <h4>Os nossos parceiros</h4>
          <div className="footer-parceiros">
            <a href="https://www.velsadigital.com/pt" target="_blank" rel="noopener noreferrer">Velsa Digital<small>Página oficial</small></a>
            <a href="https://citylink.co.mz/" target="_blank" rel="noopener noreferrer">ML-Transport<small>Página oficial</small></a>
          </div>
        </div>
        <div>
          <h4>Formas de pagamento</h4>
          <div className="footer-pagamentos">
            {METODOS_PAGAMENTO.map(m => <span key={m}><MetodoPagamentoLogo metodo={m} altura={22} /></span>)}
          </div>
        </div>
        <div>
          <h4>A nossa app</h4>
          <div className="footer-lojas">
            <span className="footer-loja"><small>Descarregar na</small>App Store</span>
            <span className="footer-loja"><small>Obtenha-o na</small>Google Play</span>
          </div>
          <p style={{ marginTop: 10 }}>Em breve.</p>
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
  );
}
