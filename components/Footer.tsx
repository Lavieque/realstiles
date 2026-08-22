import Link from 'next/link';
import Image from 'next/image';
import { getConfigSSR } from '@/lib/config-site-ssr';

export default async function Footer() {
  const config = await getConfigSSR();
  const tel1Href = `+258${config.tel1.replace(/\D/g, '')}`;
  const tel2Href = `+258${config.tel2.replace(/\D/g, '')}`;

  return (
    <footer>
      <div className="footer-grid">
        <div className="footer-logo">
          <Image src="/img/logo.png" alt="Real Stiles" height={56} width={140} style={{ height: 56, width: 'auto', marginBottom: 12 }} />
          <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>{config.footer_descricao}</p>
        </div>
        <div>
          <h4>Loja</h4>
          <ul>
            <li><Link href="/">Todos os produtos</Link></li>
            <li><Link href="/promocoes">Promoções</Link></li>
            <li><Link href="/?cat=novidades">Novidades</Link></li>
          </ul>
        </div>
        <div>
          <h4>Conta</h4>
          <ul>
            <li><Link href="/conta">A minha conta</Link></li>
            <li><Link href="/encomendas">Encomendas</Link></li>
            <li><Link href="/carrinho">Carrinho</Link></li>
          </ul>
        </div>
        <div>
          <h4>Empresa</h4>
          <ul>
            <li><Link href="/quem-somos">Quem Somos</Link></li>
            <li><Link href="/politicas">Políticas</Link></li>
            <li><Link href="/reclamacao">Reclamações</Link></li>
          </ul>
        </div>
        <div>
          <h4>Contacto</h4>
          <ul>
            <li><a href={`tel:${tel1Href}`}>{config.tel1}</a></li>
            <li><a href={`tel:${tel2Href}`}>{config.tel2}</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>{config.copyright}</span>
        <span>{config.slogan}</span>
      </div>
    </footer>
  );
}
