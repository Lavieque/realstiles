import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer>
      <div className="footer-grid">
        <div className="footer-logo">
          <Image src="/img/logo.png" alt="Real Stiles" height={56} width={140} style={{ height: 56, width: 'auto', marginBottom: 12 }} />
          <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>Encomendas diversas com segurança, transparência e agilidade.</p>
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
            <li><a href="tel:+258878753754">878 753 754</a></li>
            <li><a href="tel:+258852471608">852 471 608</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Real Stiles Multi Service. Todos os direitos reservados.</span>
        <span>Excelência em Compras</span>
      </div>
    </footer>
  );
}
