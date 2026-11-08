import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageSearch, Truck, RotateCcw, ShoppingBag, User, CreditCard, ShieldCheck, FileText, Handshake } from 'lucide-react';
import { InfoHero, InfoSecao, InfoGrelha, InfoAjuda } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Atendimento ao cliente — Real Stiles',
  description: 'Encontra respostas por tema: encomendas, envio, devoluções, produtos, conta, pagamentos e segurança.',
};

// Cada tema lista as perguntas mais comuns e leva à página que as responde.
const TEMAS = [
  { icone: PackageSearch, t: 'As minhas encomendas', itens: [
    ['Comprar na Real Stiles', '/loja'], ['Finalizar compra', '/checkout'], ['Encontrar a minha encomenda', '/acompanhar'],
    ['Cancelar a minha encomenda', '/ajuda?assunto=Produto%20e%20encomenda#mensagem'], ['Alteração de encomendas', '/ajuda?assunto=Produto%20e%20encomenda#mensagem'], ['Avaliações', '/opinioes'],
  ] },
  { icone: Truck, t: 'Envio e entrega', itens: [['Preparação do pedido', '/entregas'], ['Envio', '/entregas'], ['Entrega', '/entregas']] },
  { icone: RotateCcw, t: 'Devoluções e reembolsos', itens: [['Devoluções', '/politicas?tab=devolucoes'], ['Reembolsos', '/politicas?tab=devolucoes']] },
  { icone: ShoppingBag, t: 'Produtos e tamanhos', itens: [['Disponibilidade', '/loja'], ['Tamanho e ajuste', '/ajuda?assunto=Produto%20e%20encomenda#mensagem'], ['Informação do produto', '/loja']] },
  { icone: User, t: 'A minha conta', itens: [['Preferências da conta', '/conta'], ['Login e registo', '/conta']] },
  { icone: CreditCard, t: 'Pagamentos e promoções', itens: [['Pagamentos', '/politicas?tab=compras'], ['Promoções', '/loja?mode=promocoes']] },
  { icone: ShieldCheck, t: 'Segurança e privacidade', itens: [['Segurança e privacidade', '/seguranca']] },
  { icone: FileText, t: 'Políticas e outros', itens: [['Políticas', '/politicas'], ['Termos e condições', '/termos']] },
  { icone: Handshake, t: 'Feedback e parcerias', itens: [['Atendimento ao cliente', '/ajuda'], ['Solicitar um artigo', '/ajuda#mensagem'], ['Parcerias', '/parcerias']] },
] as const;

const FAQ: { p: string; r: React.ReactNode; acao?: [string, string] }[] = [
  { p: 'Como faço a minha primeira compra?', r: <>Escolhe um produto, seleciona a cor, o tamanho ou o modelo, quando aplicável, e adiciona ao carrinho. Confirma a quantidade, os dados de entrega e o método de pagamento antes de rever o total em meticais.</>, acao: ['Explorar produtos', '/loja'] },
  { p: 'Posso comprar sem criar uma conta?', r: <>Sim. No checkout, escolhe continuar sem conta e preenche os contactos necessários para receber a encomenda. Com conta, guardas o histórico das tuas compras.</>, acao: ['Ver o meu carrinho', '/carrinho'] },
  { p: 'Qual é o prazo de entrega?', r: <>O prazo final estimado é de 15 a 30 dias úteis, após confirmação do pagamento e da encomenda. Inclui aquisição, importação e entrega. Pode variar conforme a origem, disponibilidade, transporte e procedimentos aduaneiros.</>, acao: ['Ver entregas e preços', '/entregas'] },
  { p: 'Como acompanho a minha encomenda?', r: <>Abre Acompanhar e introduz a referência da encomenda e o telemóvel usado na compra, ou consulta as tuas compras na tua conta. Se houver uma dúvida ou divergência, pede ajuda à equipa.</>, acao: ['Acompanhar encomenda', '/acompanhar'] },
  { p: 'Como peço uma devolução ou um reembolso?', r: <>Contacta o apoio com a referência, o artigo e o motivo. Guarda os comprovativos e, quando possível, a embalagem e fotografias. A equipa analisa as condições aplicáveis e confirma os passos, o transporte e a solução antes de enviares o artigo.</>, acao: ['Pedir análise de devolução', '/ajuda?assunto=Troca%20ou%20devolu%C3%A7%C3%A3o#mensagem'] },
  { p: 'Que formas de pagamento posso escolher?', r: <>Aceitamos M-Pesa, e-Mola, mKesh e cartão (Visa e Mastercard). Confirma os dados do pagamento pelos canais oficiais antes de pagar.</>, acao: ['Ver condições de compra', '/politicas?tab=compras'] },
  { p: 'A equipa pode pedir o meu PIN ou código de confirmação?', r: <>Nunca. O PIN é só teu e só o inseres no teu telemóvel. Se alguém to pedir, não partilhes e fala connosco.</>, acao: ['Centro de segurança', '/seguranca'] },
  { p: 'Não reconheço uma cobrança. O que devo fazer?', r: <>Contacta a equipa de imediato com a referência da encomenda e o valor. Não partilhes o teu PIN nem códigos de confirmação.</>, acao: ['Falar com a equipa', '/ajuda#mensagem'] },
  { p: 'A encomenda aparece como entregue, mas não a recebi.', r: <>Contacta-nos de imediato com a referência da encomenda. Verificamos o destino e a prova de entrega. Também podes usar o livro de reclamações.</>, acao: ['Abrir livro de reclamações', '/reclamacao'] },
  { p: 'Faltam artigos na minha encomenda. Como peço ajuda?', r: <>Contacta a equipa com a referência da encomenda e fotografias da embalagem.</>, acao: ['Proteção de compras', '/protecao-compras'] },
];

export default function AtendimentoPage() {
  return (
    <>
      <InfoHero eyebrow="Atendimento ao cliente" titulo="Olá. Como podemos " destaque="ajudar?" sub="Escolhe um tema ou vê as respostas às perguntas mais frequentes.">
        <Link href="/ajuda" className="btn-escuro">Ver perguntas frequentes</Link>
        <Link href="/encomendas" className="btn-claro">Ver as minhas encomendas</Link>
      </InfoHero>

      <InfoSecao eyebrow="Registos de atendimento" titulo="Ajuda com uma " destaque="encomenda." sub="Acompanha um pedido para esclarecer artigos, envio, devoluções ou reembolsos.">
        <div className="info-hero-acoes" style={{ marginTop: 0 }}>
          <Link href="/acompanhar" className="btn-escuro">Acompanhar encomenda</Link>
          <Link href="/encomendas" className="btn-claro">Ver as minhas encomendas</Link>
        </div>
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Todos os tópicos de ajuda" titulo="Escolhe um " destaque="tema.">
        <InfoGrelha colunas={3}>
          {TEMAS.map(({ icone: Icone, t, itens }) => (
            <article key={t} className="info-cartao">
              <span className="info-cartao-icone"><Icone size={20} strokeWidth={1.5} /></span>
              <h3>{t}</h3>
              <ul className="info-cartao-lista">
                {itens.map(([nome, href]) => <li key={nome}><Link href={href}>{nome}</Link></li>)}
              </ul>
            </article>
          ))}
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao eyebrow="Respostas, sem complicações" titulo="Tópicos " destaque="recomendados." sub="10 respostas">
        <div className="faq">
          {FAQ.map(f => (
            <details key={f.p}>
              <summary>{f.p}</summary>
              <p>{f.r}</p>
              {f.acao && <p><Link href={f.acao[1]} className="info-cartao-link">{f.acao[0]} →</Link></p>}
            </details>
          ))}
        </div>
      </InfoSecao>

      <InfoAjuda />
    </>
  );
}
