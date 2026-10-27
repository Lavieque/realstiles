import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageSearch, Truck, RotateCcw, ShoppingBag, User, CreditCard, ShieldCheck, FileText, Handshake } from 'lucide-react';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha, InfoAjuda } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Atendimento ao cliente — Real Stiles',
  description: 'Encontra respostas por tema: encomendas, envio, devoluções, produtos, conta, pagamentos e segurança.',
};

const TEMAS = [
  { icone: PackageSearch, t: 'As minhas encomendas', c: 'Encontrar, acompanhar ou alterar o teu pedido.', href: '/acompanhar', acao: 'Acompanhar encomenda' },
  { icone: Truck, t: 'Envio e entrega', c: 'Preparação do pedido, envio, prazos e custos.', href: '/entregas', acao: 'Ver entregas' },
  { icone: RotateCcw, t: 'Devoluções e reembolsos', c: 'Como pedir uma análise, devolução ou reembolso.', href: '/politicas?tab=devolucoes', acao: 'Ler condições' },
  { icone: ShoppingBag, t: 'Produtos e tamanhos', c: 'Disponibilidade, tamanho e ajuste, informação do artigo.', href: '/loja', acao: 'Explorar produtos' },
  { icone: User, t: 'A minha conta', c: 'Login, registo e preferências da conta.', href: '/conta', acao: 'Abrir a conta' },
  { icone: CreditCard, t: 'Pagamentos e promoções', c: 'Formas de pagamento e artigos em promoção.', href: '/politicas?tab=compras', acao: 'Ver condições de compra' },
  { icone: ShieldCheck, t: 'Segurança e privacidade', c: 'Protege os teus dados e confirma antes de pagar.', href: '/seguranca', acao: 'Centro de segurança' },
  { icone: FileText, t: 'Políticas e termos', c: 'Políticas da loja e termos e condições.', href: '/termos', acao: 'Consultar termos' },
  { icone: Handshake, t: 'Feedback e parcerias', c: 'Sugestões, reclamações e propostas de parceria.', href: '/parcerias', acao: 'Ver parcerias' },
];

export default function AtendimentoPage() {
  return (
    <>
      <InfoHero eyebrow="Atendimento ao cliente" titulo="Olá. Como podemos " destaque="ajudar?" sub="Escolhe um tema ou vê as respostas às perguntas mais frequentes.">
        <Link href="/ajuda" className="btn-escuro">Ver perguntas frequentes</Link>
        <Link href="/encomendas" className="btn-claro">Ver as minhas encomendas</Link>
      </InfoHero>

      <InfoSecao eyebrow="Todos os tópicos de ajuda" titulo="Escolhe um " destaque="tema.">
        <InfoGrelha colunas={3}>
          {TEMAS.map(({ icone: Icone, t, c, href, acao }) => (
            <InfoCartao key={t} icone={<Icone size={20} strokeWidth={1.5} />} titulo={t} href={href} acao={acao}>{c}</InfoCartao>
          ))}
        </InfoGrelha>
      </InfoSecao>

      <InfoAjuda />
    </>
  );
}
