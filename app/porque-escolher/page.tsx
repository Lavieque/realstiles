import type { Metadata } from 'next';
import Link from 'next/link';
import { Coins, LayoutGrid, Users, ArrowRight } from 'lucide-react';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Porquê escolher a Real Stiles?',
  description: 'Uma seleção para o teu dia a dia, com preços em meticais e uma equipa próxima em cada etapa.',
};

export default function PorqueEscolherPage() {
  return (
    <>
      <InfoHero
        eyebrow="Escolhe com confiança"
        titulo="Porquê escolher "
        destaque="a Real Stiles?"
        sub="Uma seleção para o teu dia a dia, com preços em meticais e uma equipa próxima em cada etapa."
      >
        <Link href="/loja" className="btn-escuro">Explorar a coleção <ArrowRight size={16} strokeWidth={1.75} /></Link>
        <Link href="/quem-somos" className="btn-claro">Conhecer a nossa equipa</Link>
      </InfoHero>

      <InfoSecao eyebrow="Da escolha à entrega" titulo="Tudo o que precisas, " destaque="com clareza.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<Coins size={20} strokeWidth={1.5} />} titulo="Preços em meticais. Escolhas informadas." href="/ajuda" acao="Saber como comprar">
            Consulta o preço do artigo e os custos de entrega antes de confirmar. Se o pedido precisar de orçamento, revê as condições completas com a equipa.
          </InfoCartao>
          <InfoCartao icone={<LayoutGrid size={20} strokeWidth={1.5} />} titulo="Muitas escolhas. Num só lugar." href="/loja" acao="Explorar as categorias">
            Moda, eletrónica, beleza e casa. Descobre produtos para ti, para o teu espaço e para o que precisas no dia a dia.
          </InfoCartao>
          <InfoCartao icone={<Users size={20} strokeWidth={1.5} />} titulo="Uma equipa próxima. Da dúvida à escolha." href="/ajuda" acao="Pedir ajuda à equipa">
            Confirma medidas, tamanho, cor ou modelo compatível antes de encomendar. A equipa ajuda a esclarecer os detalhes do artigo e da entrega.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao>
        <p className="pol-nota">Vê também as <Link href="/opinioes" style={{ color: 'var(--black)', fontWeight: 600 }}>opiniões de quem já comprou</Link> e a nossa <Link href="/protecao-compras" style={{ color: 'var(--black)', fontWeight: 600 }}>proteção de compras</Link>.</p>
      </InfoSecao>
    </>
  );
}
