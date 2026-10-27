export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Ajuda e atendimento — Real Stiles',
  description: 'Respostas às dúvidas mais comuns e formas de falar com a equipa Real Stiles.',
};

const FAQ: { p: string; r: React.ReactNode }[] = [
  { p: 'Como faço a minha primeira compra?', r: <>Escolhe o produto, a variante (tamanho, cor) e adiciona ao carrinho. No <Link href="/checkout">checkout</Link> indicas a entrega e o pagamento. Todos os produtos são por encomenda.</> },
  { p: 'Posso comprar sem criar uma conta?', r: <>Sim. Podes finalizar como visitante. Com conta, guardas o histórico das tuas encomendas.</> },
  { p: 'Qual é o prazo de entrega?', r: <>O prazo final estimado é de 15 a 30 dias úteis, após confirmação do pagamento e da encomenda. Vê os custos em <Link href="/entregas">Entregas</Link>.</> },
  { p: 'Como acompanho a minha encomenda?', r: <>Em <Link href="/acompanhar">Acompanhar encomenda</Link> com a referência e o telemóvel usado na compra, ou na tua conta, em <Link href="/encomendas">As minhas encomendas</Link>.</> },
  { p: 'Que formas de pagamento posso escolher?', r: <>Pagas com M-Pesa, e-Mola, mKesh ou cartão, consoante o que estiver disponível no checkout.</> },
  { p: 'Como peço uma devolução ou um reembolso?', r: <>Consulta a <Link href="/politicas">política de devoluções</Link> e contacta a equipa com a referência da encomenda. Confirmamos a elegibilidade e os passos antes do envio de retorno.</> },
  { p: 'A equipa pode pedir o meu PIN ou código de confirmação?', r: <>Nunca. O PIN é só teu e só o inseres no teu telemóvel. Se alguém to pedir, não partilhes e fala connosco.</> },
  { p: 'A encomenda aparece como entregue, mas não a recebi.', r: <>Contacta-nos de imediato com a referência da encomenda. Verificamos o destino e a prova de entrega. Também podes usar o <Link href="/reclamacao">livro de reclamações</Link>.</> },
];

export default async function AjudaPage({ searchParams }: { searchParams: { topic?: string } }) {
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
