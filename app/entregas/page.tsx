export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { Store, Warehouse, Home, Clock, ArrowRight } from 'lucide-react';
import { getAdminDb } from '@/lib/firebase-admin';
import { getConfigSSR } from '@/lib/config-site-ssr';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';
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

export default async function EntregasPage() {
  const [tarifas, config] = await Promise.all([getTarifas(), getConfigSSR()]);
  const cidade = config.empresa_cidade || 'a nossa loja';
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

      <InfoSecao>
        <p className="pol-nota">O preço final depende do destino e do pacote e é confirmado antes do pagamento. Dúvidas? <Link href="/ajuda" style={{ color: 'var(--black)', fontWeight: 600 }}>Fala com a equipa</Link>.</p>
      </InfoSecao>
    </>
  );
}
