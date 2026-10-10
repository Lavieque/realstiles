'use client';
import { useEffect, useState } from 'react';
import { Loader2, Smartphone, KeyRound, CheckCircle2 } from 'lucide-react';
import MetodoPagamentoLogo from './MetodoPagamentoLogo';
import { INFO_METODO } from '@/lib/metodos-pagamento';
import type { MetodoPagamento } from '@/lib/metodos-pagamento';

const DURACAO_S = 180;

// "84 123 4567" a partir de qualquer formato introduzido
function formatarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '').replace(/^258(?=\d{9}$)/, '');
  return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : tel;
}

// Popup mostrado enquanto o cliente confirma o pagamento com o PIN no
// telemóvel. A confirmação em si é tratada por aguardarPagamento()
// (lib/pagamento-cliente.ts); aqui é só a apresentação e a contagem.
export default function AguardarPinModal({ metodo, telefone, montante, onCancelar }: {
  metodo: MetodoPagamento;
  telefone: string;
  montante: number;
  onCancelar: () => void;
}) {
  const info = INFO_METODO[metodo];
  const [restante, setRestante] = useState(DURACAO_S);

  useEffect(() => {
    const inicio = Date.now();
    const t = setInterval(() => {
      setRestante(Math.max(0, DURACAO_S - Math.floor((Date.now() - inicio) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Impede o scroll da página por trás do popup
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const mins = Math.floor(restante / 60);
  const secs = restante % 60;
  const raio = 22;
  const perimetro = 2 * Math.PI * raio;
  const progresso = restante / DURACAO_S;

  const passos = [
    { icon: <Smartphone size={16} strokeWidth={1.8} />, texto: 'Desbloqueia o telemóvel e abre a notificação' },
    { icon: <KeyRound size={16} strokeWidth={1.8} />, texto: `Introduz o teu PIN ${info.nome}` },
    { icon: <CheckCircle2 size={16} strokeWidth={1.8} />, texto: 'Confirma e volta aqui — tratamos do resto' },
  ];

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true" aria-labelledby="pin-titulo">
      <div className="pin-modal" style={{ '--mp-cor': info.cor, '--mp-fundo': info.fundo } as React.CSSProperties}>
        <div className="pin-topo">
          <MetodoPagamentoLogo metodo={metodo} altura={52} />
        </div>

        <div className="pin-telefone" aria-hidden="true">
          <span className="pin-onda" />
          <span className="pin-onda pin-onda-2" />
          <div className="pin-ecra">
            <div className="pin-pontos">
              <span /><span /><span /><span />
            </div>
          </div>
        </div>

        <h2 id="pin-titulo" className="pin-titulo">Confirma no teu telemóvel</h2>
        <p className="pin-texto">
          Enviámos um pedido de <strong>{montante.toFixed(2)} MZN</strong> para o número{' '}
          <strong style={{ whiteSpace: 'nowrap' }}>{formatarTelefone(telefone)}</strong>.
        </p>

        <ol className="pin-passos">
          {passos.map((p, i) => (
            <li key={i}>
              <span className="pin-passo-icone">{p.icon}</span>
              <span>{p.texto}</span>
            </li>
          ))}
        </ol>

        <div className="pin-estado">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r={raio} fill="none" stroke="var(--gray-200)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r={raio} fill="none" stroke={info.cor} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - progresso)}
              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
            <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--black)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {mins}:{secs.toString().padStart(2, '0')}
            </text>
          </svg>
          <div>
            <div className="pin-estado-titulo">
              <Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> A aguardar confirmação
            </div>
            <div className="pin-estado-sub">Verificamos o pagamento automaticamente. Não feches esta página.</div>
          </div>
        </div>

        <button type="button" className="btn btn-outline btn-full" onClick={onCancelar}>
          Cancelar
        </button>
        <p className="pin-rodape">Não recebeste a notificação? Cancela e tenta de novo.</p>
      </div>
    </div>
  );
}
