import type { Metadata } from 'next';
import Link from 'next/link';
import Image from '@/components/CloudImage';
import { ShoppingBag, Sparkles, MessageCircle, ShieldCheck, Package, ArrowRight, ChevronRight } from 'lucide-react';
import Estrelas from '@/components/Estrelas';
import { getOpinioes } from '@/lib/opinioes';

export const metadata: Metadata = {
  title: 'Porquê escolher a Real Stiles?',
  description: 'Uma seleção para o teu dia a dia, com preços imbatíveis em todo Moçambique, com uma equipa próxima em cada etapa.',
};

export const dynamic = 'force-dynamic';

type Aba = 'seguranca' | 'encomenda';

const PASSOS: Record<Aba, { titulo: string; passos: { t: string; c: string; href: string; acao: string; nota?: string }[] }> = {
  seguranca: {
    titulo: 'Segurança e privacidade.',
    passos: [
      {
        t: 'Pagamento à tua escolha.',
        c: 'M-Pesa, e-Mola, mKesh ou cartão, consoante o que estiver disponível no resumo da compra. Confere o valor total e guarda a referência do pedido.',
        href: '/politicas?tab=compras',
        acao: 'Consultar as condições de compra',
      },
      {
        t: 'Informação clara sobre os teus dados.',
        c: 'Podes comprar sem criar conta. Os teus dados são usados apenas para processar a encomenda e não são partilhados com terceiros.',
        href: '/politicas?tab=privacidade',
        acao: 'Ler a política de privacidade',
      },
    ],
  },
  encomenda: {
    titulo: 'Da encomenda à receção.',
    passos: [
      {
        t: 'Por encomenda, com o prazo explicado.',
        c: 'O prazo final estimado é de 15 a 30 dias úteis após a confirmação do pagamento e da encomenda. A disponibilidade do fornecedor e as variantes são confirmadas com o pedido.',
        href: '/ajuda',
        acao: 'Como funciona a encomenda',
      },
      {
        t: 'Escolhe como receber.',
        c: 'Levantamento em Chimoio, entrega urbana local ou levantamento num terminal de destino. Cobertura, transporte e custos dependem da rota e do pacote; confirma a modalidade antes de finalizar.',
        href: '/entregas#calculadora',
        acao: 'Ver modalidades e simular entrega',
      },
      {
        t: 'Uma referência em cada etapa.',
        c: 'Usa a referência da encomenda para consultar o estado do pedido, acompanhar as etapas e confirmar a receção depois da entrega.',
        href: '/acompanhar',
        acao: 'Acompanhar uma encomenda',
      },
      {
        t: 'Apoio também depois da entrega.',
        c: 'Se houver um dano, um artigo incorreto ou um pedido de devolução, contacta o apoio com a referência e o motivo. As condições, a elegibilidade e os passos seguintes são analisados conforme a compra.',
        href: '/politicas?tab=devolucoes',
        acao: 'Consultar devoluções e reembolsos',
      },
    ],
  },
};

export default async function PorqueEscolherPage({ searchParams }: { searchParams: { tab?: string } }) {
  const opinioes = (await getOpinioes()).slice(0, 3);
  const aba: Aba = searchParams.tab === 'encomenda' ? 'encomenda' : 'seguranca';
  const painel = PASSOS[aba];

  return (
    <div className="pe-pagina"><div className="pe-wrap">
      <nav className="pe-trilho" aria-label="Localização">
        <Link href="/">Início</Link><ChevronRight size={13} aria-hidden="true" /><span>Porquê escolher a Real Stiles?</span>
      </nav>

      <header className="pe-hero">
        <div>
          <span className="eyebrow">Escolhe com confiança</span>
          <h1 className="display-titulo">Porquê escolher <em>a Real Stiles?</em></h1>
          <p>Uma seleção para o teu dia a dia, com preços imbatíveis em todo Moçambique, com uma equipa próxima em cada etapa.</p>
          <div className="pe-hero-acoes">
            <Link href="/loja" className="pe-btn-ouro">Explorar a coleção <ArrowRight size={15} strokeWidth={1.75} /></Link>
            <Link href="/quem-somos" className="pe-link-claro">Conhecer a nossa equipa <ChevronRight size={14} /></Link>
          </div>
        </div>
        <div className="pe-selo" aria-hidden="true">
          <ShieldCheck size={52} strokeWidth={1.25} />
          <span>Da escolha<br />à entrega.</span>
        </div>
      </header>

      <div className="pe-cartoes">
        <article className="pe-cartao">
          <span className="pe-cartao-icone"><ShoppingBag size={18} strokeWidth={1.5} /></span>
          <h2>Preços em meticais.<br />Escolhas informadas.</h2>
          <p>Consulta o preço do artigo e os custos de entrega antes de confirmar. Se o pedido precisar de orçamento, revê as condições completas com a equipa.</p>
          <Link href="/ajuda" className="pe-link">Saber como comprar <ChevronRight size={14} /></Link>
        </article>
        <article className="pe-cartao">
          <span className="pe-cartao-icone"><Sparkles size={18} strokeWidth={1.5} /></span>
          <h2>Muitas escolhas.<br />Num só lugar.</h2>
          <p>Moda, eletrónica, beleza e casa. Descobre produtos para ti, para o teu espaço e para o que precisas no dia a dia.</p>
          <Link href="/loja" className="pe-link">Explorar as categorias <ChevronRight size={14} /></Link>
        </article>
        <article className="pe-cartao">
          <span className="pe-cartao-icone"><MessageCircle size={18} strokeWidth={1.5} /></span>
          <h2>Uma equipa próxima.<br />Da dúvida à escolha.</h2>
          <p>Confirma medidas, tamanho, cor ou modelo compatível antes de encomendar. A equipa ajuda a esclarecer os detalhes do artigo e da entrega.</p>
          <Link href="/ajuda" className="pe-link">Pedir ajuda à equipa <ChevronRight size={14} /></Link>
        </article>
      </div>

      <div id="abas" className="pe-abas" role="tablist">
        <Link href="/porque-escolher?tab=seguranca#abas" scroll={false} role="tab" aria-selected={aba === 'seguranca'} className={`pe-aba${aba === 'seguranca' ? ' activo' : ''}`}>
          <ShieldCheck size={18} strokeWidth={1.5} /> Segurança e privacidade
        </Link>
        <Link href="/porque-escolher?tab=encomenda#abas" scroll={false} role="tab" aria-selected={aba === 'encomenda'} className={`pe-aba${aba === 'encomenda' ? ' activo' : ''}`}>
          <Package size={18} strokeWidth={1.5} /> A tua encomenda
        </Link>
      </div>
      <section className="pe-painel" role="tabpanel">
        <div className="pe-painel-cab">
          <span className="eyebrow">Informação para cada etapa</span>
          <h2 className="display-titulo">{painel.titulo}</h2>
        </div>
        <ol className="pe-passos" style={{ listStyle: 'none' }}>
          {painel.passos.map((p, i) => (
            <li key={p.t} className="pe-passo">
              <span className="pe-passo-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{p.t}</h3>
                <p>{p.c}</p>
                <Link href={p.href} className="pe-link">{p.acao} <ChevronRight size={14} /></Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pe-opinioes">
        <div className="pe-opinioes-inner">
          <div className="pe-opinioes-cab">
            <div>
              <span className="eyebrow">A tua experiência conta</span>
              <h2 className="display-titulo">Opiniões que ajudam a escolher.</h2>
            </div>
            <Link href="/encomendas" className="pe-link">Ver as minhas compras <ChevronRight size={14} /></Link>
          </div>
          {opinioes.length > 0 ? (
            <>
              <p className="pe-opinioes-nota">Avaliações de clientes que já receberam os artigos.</p>
              <div className="info-grelha c3 pe-op">
                {opinioes.map(o => (
                  <article key={o.id} className="pe-opiniao">
                    <span className="pe-opiniao-autor">{o.cliente_nome}</span>
                    <Estrelas valor={o.estrelas} tamanho={15} />
                    <p>{o.texto}</p>
                    <Link href={`/produto/${o.produto_id}`} className="pe-opiniao-produto">
                      <span className="pe-opiniao-img">
                        {o.produto_imagem && <Image src={o.produto_imagem} alt="" fill style={{ objectFit: 'cover' }} sizes="36px" />}
                      </span>
                      <span style={{ flex: 1 }}>{o.produto_nome}</span>
                      <ChevronRight size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="pe-opinioes-nota" style={{ marginBottom: 0 }}>Ainda sem opiniões publicadas. As avaliações de quem já recebeu os artigos aparecem aqui.</p>
          )}
          <div className="pe-opinioes-mais">
            <Link href="/opinioes" className="pe-btn-contorno">Ver mais opiniões <ChevronRight size={14} /></Link>
          </div>
        </div>
      </section>

      <section className="pe-duvida">
        <h2 className="display-titulo">Uma dúvida? <em style={{ display: 'inline' }}>Fala connosco.</em></h2>
        <p>Ajuda a escolher, confirmar o pedido ou resolver uma ocorrência.</p>
        <Link href="/ajuda" className="btn-escuro">Falar com a equipa</Link>
      </section>
    </div></div>
  );
}
