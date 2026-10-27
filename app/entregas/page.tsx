export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Store, Warehouse, Home, Clock, ArrowRight } from 'lucide-react';
import { getAdminDb } from '@/lib/firebase-admin';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha, InfoPassos, InfoAjuda } from '@/components/InfoPagina';
import CalculadoraEntrega from '@/components/CalculadoraEntrega';
import Preco from '@/components/Preco';
import type { TarifaEntrega, Modalidade } from '@/lib/entregas';

export const metadata: Metadata = {
  title: 'Entregas — Real Stiles',
  description: 'Recolha, levantamento em terminal ou entrega na morada. Conhece os custos antes de encomendar.',
};

async function getTarifas(): Promise<TarifaEntrega[]> {
  try {
    const db = getAdminDb();
    if (!db) return [];
    const snap = await db.collection('config').doc('entregas').get();
    return (snap.data()?.itens || []) as TarifaEntrega[];
  } catch {
    return [];
  }
}

// Menor preço base configurado para uma modalidade ("desde …")
function desde(tarifas: TarifaEntrega[], m: Modalidade): number | null {
  const precos = tarifas.filter(t => t.modalidade === m).map(t => t.preco_base);
  return precos.length ? Math.min(...precos) : null;
}

export default async function EntregasPage({ searchParams }: { searchParams: { calcular?: string } }) {
  if (searchParams.calcular === '1') redirect('/entregas#calculadora');
  const [tarifas, config] = await Promise.all([getTarifas(), getConfigSSR()]);
  const cidade = (config.empresa_cidade || '').split(',')[0].trim() || 'a nossa loja';
  const dTerminal = desde(tarifas, 'terminal');
  const dDomicilio = desde(tarifas, 'domicilio');

  return (
    <>
      <InfoHero
        eyebrow="Entregas Real Stiles"
        titulo="A tua encomenda, "
        destaque="mais perto de ti."
        sub="Escolhe como receber e conhece os custos antes de encomendar."
      >
        <a href="#calculadora" className="btn-escuro">Calcular entrega <ArrowRight size={16} strokeWidth={1.75} /></a>
        <Link href="/acompanhar" className="btn-claro">Acompanhar encomenda</Link>
      </InfoHero>

      <InfoSecao>
        <div className="info-prazo">
          <Clock size={22} strokeWidth={1.5} />
          <div>
            <small>Prazo final estimado</small>
            <strong>15 a 30 dias úteis</strong>
            <p>Após confirmação do pagamento e da encomenda. Inclui aquisição, importação e entrega. Entrega ao domicílio mediante consulta e confirmação prévia.</p>
          </div>
        </div>
      </InfoSecao>

      <InfoSecao eyebrow="Como queres receber?" titulo="Escolhe a opção " destaque="que funciona melhor para ti.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<Store size={20} strokeWidth={1.5} />} titulo={`Recolha em ${cidade}`}>
            <span className="info-preco">Grátis</span><br />
            {config.entrega_recolha_info || 'Levanta a tua encomenda após aviso, num horário combinado.'}
          </InfoCartao>
          <InfoCartao icone={<Warehouse size={20} strokeWidth={1.5} />} titulo="Levantamento em terminal">
            <span className="info-preco">{dTerminal !== null ? <>Desde <Preco valor={dTerminal} /></> : 'Sob orçamento'}</span><br />
            Recebe num terminal da rota. O ponto de levantamento é confirmado contigo.
          </InfoCartao>
          <InfoCartao icone={<Home size={20} strokeWidth={1.5} />} titulo="Entrega ao domicílio">
            <span className="info-preco">{dDomicilio !== null ? <>Desde <Preco valor={dDomicilio} /></> : 'Sob consulta'}</span><br />
            Entrega na morada, sujeita a confirmação do perímetro e do peso do pacote.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao eyebrow="Sem complicações" titulo="Quanto custa " destaque="chegar até ti?" sub="Indica o destino e escolhe como receber. A estimativa atualiza-se com as tuas opções.">
        <div id="calculadora">
          <CalculadoraEntrega tarifasIniciais={tarifas} />
        </div>
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Contigo em cada etapa" titulo="Da encomenda " destaque="à tua mão.">
        <InfoPassos passos={[
          { t: 'Confirmamos a encomenda', c: 'Revês os artigos, o pagamento, a modalidade e os custos.' },
          { t: 'Preparamos e expedimos', c: 'Adquirimos os artigos, conferimos a embalagem e organizamos o envio.' },
          { t: 'Avisamos para receber', c: 'Acompanhas com a referência e confirmas quando podes receber ou levantar.' },
        ]} />
        <p style={{ marginTop: 20 }}><Link href="/acompanhar" className="info-cartao-link">Já tenho uma referência: acompanhar encomenda <ArrowRight size={14} strokeWidth={1.75} /></Link></p>
      </InfoSecao>

      <InfoSecao eyebrow={`De ${cidade} para o teu mundo`} titulo="Uma base próxima. " destaque="Mais caminhos até ti." sub="A disponibilidade de cada rota é confirmada com a equipa.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<Store size={20} strokeWidth={1.5} />} titulo={cidade}>Recolha e entrega urbana, com perímetro a confirmar.</InfoCartao>
          <InfoCartao icone={<Warehouse size={20} strokeWidth={1.5} />} titulo="Beira · Tete · Quelimane · Nampula · Maputo">Levantamento em terminal, sujeito a confirmação da rota e do ponto.</InfoCartao>
          <InfoCartao icone={<Home size={20} strokeWidth={1.5} />} titulo="Outras cidades e distritos">A equipa confirma cobertura, preço e modalidade contigo.</InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao eyebrow="Respostas simples" titulo="Antes de " destaque="receber." sub="O essencial para planeares a tua entrega com confiança.">
        <div className="faq">
          <details><summary>Quanto tempo demora a minha encomenda?</summary><p>O prazo final estimado é de 15 a 30 dias úteis, após a confirmação do pagamento e da encomenda.</p></details>
          <details><summary>A entrega é sempre em minha casa?</summary><p>Não. Podes recolher em {cidade}, levantar num terminal ou pedir entrega ao domicílio, que depende de consulta e confirmação prévia.</p></details>
          <details><summary>E se eu não souber o peso do pacote?</summary><p>Podes usar os artigos do teu carrinho na calculadora ou escolher &ldquo;Ainda não sei o peso&rdquo;. A equipa confirma o valor final antes do pagamento.</p></details>
          <details><summary>Como sei que já posso levantar?</summary><p>Avisamos-te quando a encomenda estiver pronta. Também podes acompanhar o estado em <Link href="/acompanhar">Acompanhar encomenda</Link>.</p></details>
          <details><summary>O que faço se houver um atraso ou um problema?</summary><p>Contacta a equipa com a referência da encomenda. Vê também a <Link href="/protecao-compras">proteção de compras</Link>.</p></details>
        </div>
      </InfoSecao>

      <InfoAjuda />

      <InfoSecao>
        <p className="pol-nota">O preço final depende do destino e do pacote e é confirmado antes do pagamento. Dúvidas? <Link href="/ajuda" style={{ color: 'var(--black)', fontWeight: 600 }}>Fala com a equipa</Link>.</p>
      </InfoSecao>
    </>
  );
}
