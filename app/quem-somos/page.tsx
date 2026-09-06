import type { Metadata } from 'next';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import { getConfigSSR } from '@/lib/config-site-ssr';

export const metadata: Metadata = {
  title: 'Quem Somos — Real Stiles',
  description: 'A Real Stiles Multi Service é uma empresa de intermediação de encomendas — com segurança, transparência e agilidade.',
};

export default async function QuemSomosPage() {
  const config = await getConfigSSR();

  const membros = [
    { nome: config.qs_membro1_nome, cargo: config.qs_membro1_cargo, foto: config.qs_membro1_foto, bio: config.qs_membro1_bio },
    { nome: config.qs_membro2_nome, cargo: config.qs_membro2_cargo, foto: config.qs_membro2_foto, bio: config.qs_membro2_bio },
  ].filter(m => m.nome.trim());

  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ');

  return (
    <>
      {/* HERO */}
      <section className="qs-hero">
        <h1>Quem <span>Somos</span></h1>
        <p>
          A <strong style={{ color: 'white' }}>Real Stiles Multi Service</strong> é uma empresa de intermediação de encomendas.
          Fazemos as suas compras por si — com segurança, transparência e agilidade.
        </p>
        <span className="qs-hero-badge">{config.slogan}</span>
      </section>

      {/* SOBRE */}
      <section className="qs-sobre">
        <p className="secao-label">A nossa história</p>
        <h2>{config.qs_sobre_titulo}</h2>
        <p>{config.qs_sobre_texto1}</p>
        <p>{config.qs_sobre_texto2}</p>
      </section>

      {/* COMO FUNCIONA */}
      <section className="qs-como">
        <div className="qs-como-inner">
          <h2>Como Trabalhamos</h2>
          <div className="qs-pilares">
            <div className="qs-pilar">
              <div className="qs-pilar-icon">🛒</div>
              <h3>Escolha com Confiança</h3>
              <p>Compramos para você o produto que precisar, onde quer que esteja.</p>
              <div className="linha"></div>
            </div>
            <div className="qs-pilar">
              <div className="qs-pilar-icon">🛡️</div>
              <h3>Total Segurança</h3>
              <p>Protegemos a sua compra em cada etapa do processo.</p>
              <div className="linha"></div>
            </div>
            <div className="qs-pilar">
              <div className="qs-pilar-icon">⚡</div>
              <h3>Agilidade</h3>
              <p>Receba o que precisa, sem demora e sem complicações.</p>
              <div className="linha"></div>
            </div>
          </div>
        </div>
      </section>

      {/* VALORES */}
      <section className="qs-valores">
        <div className="qs-valores-inner">
          <h2>Os Nossos Valores</h2>
          <div className="qs-valores-grid">
            <div className="qs-valor">
              <div className="qs-valor-icon">🔒</div>
              <h3>Privacidade</h3>
              <p>Os seus dados estão sempre protegidos e nunca são partilhados com terceiros.</p>
            </div>
            <div className="qs-valor">
              <div className="qs-valor-icon">🔍</div>
              <h3>Transparência</h3>
              <p>Você acompanha tudo do início ao fim — sem surpresas, sem custos escondidos.</p>
            </div>
            <div className="qs-valor">
              <div className="qs-valor-icon">⭐</div>
              <h3>Qualidade</h3>
              <p>Selecionamos o melhor para você, com critério e atenção em cada encomenda.</p>
            </div>
            <div className="qs-valor">
              <div className="qs-valor-icon">🤝</div>
              <h3>Confiança</h3>
              <p>Ética e compromisso em cada compra — a nossa reputação é o nosso maior activo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* EQUIPA */}
      {membros.length > 0 && (
        <section className="qs-equipa">
          <div className="qs-equipa-inner">
            <h2>{config.qs_equipa_titulo}</h2>
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
          </div>
        </section>
      )}

      {/* LOCALIZAÇÃO */}
      {morada && (
        <section className="qs-localizacao">
          <div className="qs-localizacao-inner">
            <h2>{config.qs_localizacao_titulo}</h2>
            <p className="qs-localizacao-morada">{morada}</p>
            <div className="qs-localizacao-mapa">
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(morada)}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização"
              />
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="qs-cta">
        <h2>{config.qs_cta_titulo}</h2>
        <p>{config.qs_cta_subtitulo}</p>
        <div className="qs-contactos">
          <a href={`tel:${config.tel1.replace(/\D/g, '')}`} className="qs-contacto"><span>📞</span> {config.tel1}</a>
          <a href={`tel:${config.tel2.replace(/\D/g, '')}`} className="qs-contacto"><span>📞</span> {config.tel2}</a>
        </div>
        <Link href="/" className="btn btn-primary">Ver produtos disponíveis</Link>
      </section>
    </>
  );
}
