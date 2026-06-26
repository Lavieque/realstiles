import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quem Somos — Real Stiles',
  description: 'Conheça a Real Stiles Multi Service — encomendas diversas com segurança, transparência e agilidade.',
};

export default function QuemSomosPage() {
  return (
    <div className="page-wrapper">
      {/* Hero */}
      <section style={{ background: 'var(--black)', color: 'white', padding: 'calc(var(--nav-h) + 60px) 5% 60px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 16 }}>A nossa história</p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 700, maxWidth: 600, margin: '0 auto' }}>
          O seu pedido, a nossa responsabilidade
        </h1>
      </section>

      <div className="container" style={{ paddingTop: 64, paddingBottom: 80 }}>
        {/* Sobre */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 64, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', fontWeight: 700, marginBottom: 20 }}>Quem somos</h2>
            <p style={{ color: 'var(--gray-600)', lineHeight: 1.8, marginBottom: 16 }}>
              A Real Stiles Multi Service nasceu da vontade de simplificar o processo de compra para quem não tem tempo, acesso ou facilidade para adquirir produtos onde quer que estejam. Fazemos encomendas diversas em nome dos nossos clientes, garantindo que cada produto chega nas melhores condições.
            </p>
            <p style={{ color: 'var(--gray-600)', lineHeight: 1.8 }}>
              Seja um produto nacional ou internacional, você escolhe e nós compramos para você — com total compromisso desde o primeiro contacto até à entrega final.
            </p>
          </div>
          <div style={{ background: 'var(--black)', borderRadius: 20, padding: 40, color: 'white' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[{ n: '500+', l: 'Clientes satisfeitos' }, { n: '1000+', l: 'Encomendas entregues' }, { n: '100%', l: 'Compromisso' }, { n: '24h', l: 'Resposta garantida' }].map(s => (
                <div key={s.l} style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{s.n}</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: 'var(--accent-light)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', fontWeight: 700, marginBottom: 12 }}>Pronto para fazer o seu pedido?</h2>
          <p style={{ color: 'var(--gray-600)', marginBottom: 28 }}>Fale connosco e diga-nos o que precisa. Tratamos de tudo com rapidez e segurança.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-primary btn-lg">Ver produtos</Link>
            <a href="https://wa.me/258878753754" className="btn btn-outline btn-lg" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      </div>
    </div>
  );
}
