'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

// Painel de filtros lateral usado em todo o site. No desktop fica sempre
// aberto ao lado da lista; em mobile (≤768px) fica colapsado e abre ao tocar
// em "Filtros" (ver .filtros-sidebar em globals.css).
export default function FiltrosSidebar({
  numActivos = 0,
  onLimpar,
  contagem,
  fecharQuando,
  children,
}: {
  numActivos?: number;
  onLimpar?: () => void;
  contagem?: string;
  // Fecha o painel (mobile) sempre que este valor muda — ex.: ao escolher uma categoria
  fecharQuando?: unknown;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => { setAberto(false); }, [fecharQuando]);

  return (
    <aside className={`filtros-sidebar${aberto ? ' aberto' : ''}`}>
      <div className="filtros-sidebar-header">
        {/* Em mobile o título é o botão que abre/fecha os filtros */}
        <button
          type="button"
          className="filtros-toggle"
          onClick={() => setAberto(v => !v)}
          aria-expanded={aberto}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} className="filtros-toggle-icone" />
          <span>Filtros</span>
          {numActivos > 0 && <span className="filtros-toggle-contador">{numActivos}</span>}
          <ChevronDown size={16} strokeWidth={1.5} className="filtros-toggle-seta" />
        </button>
        {onLimpar && numActivos > 0 && (
          <button className="filtros-limpar" onClick={onLimpar}>Limpar</button>
        )}
      </div>

      <div className="filtros-corpo">
        {children}
        {contagem && <p className="filtros-contagem">{contagem}</p>}
      </div>
    </aside>
  );
}

export function FiltroGrupo({ titulo, primeiro = false, children }: { titulo: string; primeiro?: boolean; children: ReactNode }) {
  return (
    <div className="filtro-grupo" style={primeiro ? { borderTop: 'none', paddingTop: 0 } : undefined}>
      <p className="filtro-grupo-titulo">{titulo}</p>
      {children}
    </div>
  );
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const INTERVALOS_PRECO = [
  { label: 'Todos os preços', min: 0, max: Infinity },
  { label: 'Até 500 MZN', min: 0, max: 500 },
  { label: '500 – 1 000', min: 500, max: 1000 },
  { label: '1 000 – 2 000', min: 1000, max: 2000 },
  { label: '2 000+', min: 2000, max: Infinity },
];

export function dentroDoIntervalo(preco: number, idx: number): boolean {
  const i = INTERVALOS_PRECO[idx] ?? INTERVALOS_PRECO[0];
  return preco >= i.min && preco <= i.max;
}

// Lista de opções em rádio (preço, estado, ordenação…)
export function FiltroOpcoes<T extends string | number>({
  nome,
  opcoes,
  valor,
  onChange,
}: {
  nome: string;
  opcoes: { valor: T; label: string; extra?: ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      {opcoes.map(o => (
        <label key={String(o.valor)} className="filtro-radio">
          <input type="radio" name={nome} checked={valor === o.valor} onChange={() => onChange(o.valor)} />
          <span>{o.label}</span>
          {o.extra}
        </label>
      ))}
    </>
  );
}

export function FiltroPreco({ valor, onChange }: { valor: number; onChange: (idx: number) => void }) {
  return (
    <FiltroOpcoes
      nome="preco"
      opcoes={INTERVALOS_PRECO.map((f, i) => ({ valor: i, label: f.label }))}
      valor={valor}
      onChange={onChange}
    />
  );
}

// Lista de categorias com "Todos" e "Ver mais" a partir de `visiveis` itens
export function FiltroCategorias({
  categorias,
  actual,
  onChange,
  visiveis = 8,
  rotuloTodos = 'Todos',
}: {
  categorias: string[];
  actual: string | null;
  onChange: (cat: string | null) => void;
  visiveis?: number;
  rotuloTodos?: string;
}) {
  const [expandida, setExpandida] = useState(false);
  const lista = expandida ? categorias : categorias.slice(0, visiveis);

  return (
    <>
      <div className="filtro-cat-lista">
        <button className={`filtro-cat-item${!actual ? ' active' : ''}`} onClick={() => { setExpandida(false); onChange(null); }}>
          {rotuloTodos}
        </button>
        {lista.map(cat => (
          <button key={cat} className={`filtro-cat-item${actual === cat ? ' active' : ''}`} onClick={() => { setExpandida(false); onChange(cat); }}>
            {capitalizar(cat)}
          </button>
        ))}
      </div>
      {categorias.length > visiveis && (
        <button className="filtro-cat-vermais" onClick={() => setExpandida(v => !v)}>
          {expandida ? 'Ver menos' : `Ver mais (${categorias.length - visiveis})`}
        </button>
      )}
    </>
  );
}
