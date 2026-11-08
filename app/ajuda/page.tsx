export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';
import FormContacto from '@/components/FormContacto';

export const metadata: Metadata = {
  title: 'Ajuda e atendimento — Real Stiles',
  description: 'Respostas às dúvidas mais comuns e formas de falar com a equipa Real Stiles.',
};

const FAQ: { p: string; r: React.ReactNode }[] = [
  { p: 'Como funciona uma compra?', r: <>Escolhe o produto, seleciona a variante e confirma os dados de entrega no <Link href="/checkout">checkout</Link>. A encomenda avança após confirmação do pagamento e da disponibilidade do fornecedor.</> },
  { p: 'Como posso pagar?', r: <>A seleção inclui M-Pesa, e-Mola, mKesh e cartão (Visa e Mastercard), consoante o que estiver disponível no checkout.</> },
  { p: 'Quanto tempo demora a entrega?', r: <>Todos os produtos são por encomenda. O prazo final estimado é de 15 a 30 dias úteis, após confirmação do pagamento e da encomenda, incluindo aquisição, importação e entrega final. A modalidade e o destino são confirmados com a compra. Vê os custos em <Link href="/entregas">Entregas</Link>.</> },
  { p: 'Posso pedir um produto que não está no catálogo?', r: <>A Real Stiles faz intermediação de compras de produtos nacionais e internacionais. Fala com a equipa, indica o produto e pede confirmação de disponibilidade e condições.</> },
  { p: 'Como peço uma devolução?', r: <>Contacta a equipa com a referência, o produto e o motivo do pedido. As condições e os prazos dependem da compra e da <Link href="/politicas?tab=devolucoes">política de devoluções</Link>.</> },
  { p: 'Como acompanho a encomenda?', r: <>Usa a referência na página <Link href="/acompanhar">Acompanhar encomenda</Link>, ou vê as tuas compras em <Link href="/encomendas">As minhas encomendas</Link>.</> },
];

export default async function AjudaPage({ searchParams }: { searchParams: { topic?: string; assunto?: string; produto?: string } }) {
  if (searchParams.topic === 'reclamacao') redirect('/reclamacao');
  const config = await getConfigSSR();
  const wa = `258${config.tel1.replace(/\D/g, '')}`;
  const morada = [config.empresa_morada, config.empresa_cidade].filter(Boolean).join(', ');

  return (
    <>
      <InfoHero
        eyebrow="Uma equipa próxima"
        titulo="Como podemos "
        destaque="ajudar?"
        sub="Da primeira escolha à entrega, estamos contigo."
      >
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn-escuro"><MessageCircle size={16} strokeWidth={1.5} /> Falar com a equipa</a>
        <Link href="/acompanhar" className="btn-claro">Acompanhar encomenda</Link>
        {['Produto e encomenda', 'Troca ou devolução', 'Reclamação', 'Orçamento de entrega'].map(a => (
          <Link key={a} href={`/ajuda?assunto=${encodeURIComponent(a)}#mensagem`} className="btn-claro">{a}</Link>
        ))}
      </InfoHero>

      <InfoSecao eyebrow="Respostas, sem complicações" titulo="Talvez a resposta " destaque="esteja aqui.">
        <div className="faq">
          {FAQ.map(f => (
            <details key={f.p}>
              <summary>{f.p}</summary>
              <p>{f.r}</p>
            </details>
          ))}
        </div>
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Fala com a Real Stiles" titulo="Estamos " destaque="por perto.">
        <InfoGrelha colunas={4}>
          <InfoCartao icone={<Phone size={20} strokeWidth={1.5} />} titulo="Telefone">
            <a href={`tel:+258${config.tel1.replace(/\D/g, '')}`}>{config.tel1}</a><br />
            <a href={`tel:+258${config.tel2.replace(/\D/g, '')}`}>{config.tel2}</a>
          </InfoCartao>
          <InfoCartao icone={<MessageCircle size={20} strokeWidth={1.5} />} titulo="WhatsApp" href={`https://wa.me/${wa}`} acao="Abrir conversa">
            Respostas rápidas sobre produtos, pagamento e entrega.
          </InfoCartao>
          <InfoCartao icone={<Mail size={20} strokeWidth={1.5} />} titulo="Email">
            <a href="mailto:geral@realstiles.co.mz">geral@realstiles.co.mz</a>
          </InfoCartao>
          <InfoCartao icone={<MapPin size={20} strokeWidth={1.5} />} titulo="Onde estamos">
            {morada || 'Chimoio, Manica, Moçambique'}
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao eyebrow="Vamos conversar" titulo="Deixa a tua " destaque="mensagem.">
        <div id="mensagem" style={{ scrollMarginTop: 120 }}><FormContacto key={`${searchParams.assunto || ''}|${searchParams.produto || ''}`} assuntoInicial={searchParams.assunto || ''} mensagemInicial={searchParams.produto ? `Tenho uma dúvida sobre o tamanho do artigo “${searchParams.produto.slice(0, 120)}”. ` : ''} /></div>
      </InfoSecao>

      <InfoSecao>
        <InfoGrelha colunas={2}>
          <InfoCartao icone={<FileText size={20} strokeWidth={1.5} />} titulo="Reclamação" href="/reclamacao" acao="Abrir livro de reclamações">
            Não ficaste satisfeito? Regista a tua reclamação e a equipa responde.
          </InfoCartao>
          <InfoCartao icone={<FileText size={20} strokeWidth={1.5} />} titulo="Política de compras" href="/politicas" acao="Ler condições">
            Compras, entregas, devoluções, privacidade e termos num só lugar.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>
    </>
  );
}
