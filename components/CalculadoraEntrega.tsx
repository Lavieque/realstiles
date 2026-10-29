'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Preco from '@/components/Preco';
import { PROVINCIAS, MODALIDADES, ZONAS, encontrarTarifa, calcularEntrega } from '@/lib/entregas';
import type { TarifaEntrega, Modalidade, Zona } from '@/lib/entregas';

// Calculadora pública: lê as tarifas configuradas em /admin/taxas.
export default function CalculadoraEntrega({ tarifasIniciais = [] }: { tarifasIniciais?: TarifaEntrega[] }) {
  const [tarifas, setTarifas] = useState<TarifaEntrega[]>(tarifasIniciais);
  const [provincia, setProvincia] = useState<string>(PROVINCIAS[0]);
  const [modalidade, setModalidade] = useState<Modalidade>('terminal');
  const [zona, setZona] = useState<Zona>('urbana');
  const [peso, setPeso] = useState('');

  useEffect(() => {
    fetch('/api/config/entregas').then(r => r.json()).then(d => setTarifas(d.itens || [])).catch(() => {});
  }, []);

  const pesoKg = Number(peso.replace(',', '.'));
  const pesoValido = peso !== '' && Number.isFinite(pesoKg) && pesoKg >= 0;

  const { tarifa, valor } = useMemo(() => {
    const pedido = { provincia, modalidade, zona, pesoKg: pesoValido ? pesoKg : 0 };
    return { tarifa: encontrarTarifa(tarifas, pedido), valor: calcularEntrega(tarifas, pedido) };
  }, [tarifas, provincia, modalidade, zona, pesoKg, pesoValido]);

  // Recolha na loja não tem custo de entrega quando não há tarifa definida
  const gratis = modalidade === 'recolha' && !tarifa;

  return (
    <div className="calc">
      <form className="calc-form" onSubmit={e => e.preventDefault()}>
        <div className="calc-bloco">
          <p className="calc-passo">01 · O teu destino</p>
          <div className="form-group">
            <label htmlFor="calc-prov">Província</label>
            <select id="calc-prov" value={provincia} onChange={e => setProvincia(e.target.value)}>
              {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="calc-bloco">
          <p className="calc-passo">02 · Como preferes receber?</p>
          <div className="form-group">
            <label htmlFor="calc-mod">Modalidade</label>
            <select id="calc-mod" value={modalidade} onChange={e => setModalidade(e.target.value as Modalidade)}>
              {(Object.keys(MODALIDADES) as Modalidade[]).map(m => <option key={m} value={m}>{MODALIDADES[m]}</option>)}
            </select>
          </div>
          {modalidade === 'domicilio' && (
            <div className="form-group">
              <label htmlFor="calc-zona">Zona da morada</label>
              <select id="calc-zona" value={zona || 'urbana'} onChange={e => setZona(e.target.value as Zona)}>
                {(Object.keys(ZONAS) as Exclude<Zona, ''>[]).map(z => <option key={z} value={z}>{ZONAS[z]}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="calc-bloco">
          <p className="calc-passo">03 · O que vamos enviar?</p>
          <div className="form-group">
            <label htmlFor="calc-peso">Peso do pacote (kg) — opcional</label>
            <input id="calc-peso" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder="Ex: 1,5" />
          </div>
          <p className="checkout-nota">Não precisas de indicar nome, telefone ou morada completa.</p>
        </div>
      </form>

      <aside className="calc-resultado" aria-live="polite">
        <h3>A tua estimativa</h3>
        {gratis ? (
          <>
            <p className="calc-valor">Grátis</p>
            <p className="calc-detalhe">Recolha na loja, sem taxa de entrega. Combinamos o ponto e o horário contigo.</p>
          </>
        ) : valor !== null ? (
          <>
            <p className="calc-valor"><Preco valor={valor} /></p>
            <p className="calc-detalhe">
              {provincia} · {MODALIDADES[modalidade]}
              {modalidade === 'domicilio' && ` · ${ZONAS[(zona || 'urbana') as Exclude<Zona, ''>]}`}
              {tarifa && tarifa.preco_kg > 0 && !pesoValido && <><br />Indica o peso para somar o custo por kg.</>}
            </p>
          </>
        ) : (
          <>
            <p className="calc-valor" style={{ fontSize: '1.7rem' }}>Sob orçamento</p>
            <p className="calc-detalhe">Ainda não temos um preço fixo para este destino. <Link href="/ajuda" style={{ color: 'var(--black)', fontWeight: 600 }}>Pede um orçamento</Link> e respondemos com o valor.</p>
          </>
        )}
        <p className="calc-prazo"><strong>15 a 30 dias úteis</strong>Prazo final estimado, após confirmação do pagamento e da encomenda. Inclui aquisição, importação e entrega. O valor final é confirmado antes de pagares.</p>
      </aside>
    </div>
  );
}
