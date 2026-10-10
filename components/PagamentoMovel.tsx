'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone, KeyRound, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import MetodoPagamentoLogo from './MetodoPagamentoLogo';
import { INFO_METODO } from '@/lib/metodos-pagamento';
import type { MetodoPagamento } from '@/lib/metodos-pagamento';
import { aguardarPagamento, consultarEstadoPagamento } from '@/lib/pagamento-cliente';
import type { RespostaPagamento } from '@/lib/pagamento-cliente';

// Popup do pagamento por telemóvel (M-Pesa, e-Mola, mKesh). Abre logo ao
// carregar em "Pagar" e trata de tudo até ao desfecho:
//   aguardar  → pedido enviado; contagem do tempo para introduzir o PIN
//   verificar → o tempo acabou; última confirmação com a operadora
//   expirado  → sem confirmação: PIN não introduzido a tempo (ou outra causa)
//   falhado   → a operadora recusou (mostra o motivo)
// A ClicPay só responde ao pedido depois do PIN, por isso o popup não pode
// esperar pela resposta para aparecer.

type Fase = 'aguardar' | 'verificar' | 'expirado' | 'falhado';

const VERIFICACOES_FINAIS = 3;
const INTERVALO_VERIFICACAO_MS = 5000;

function formatarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '').replace(/^258(?=\d{9}$)/, '');
  return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : tel;
}

export default function PagamentoMovel({ encomendaId, metodo, telefone, montante, iniciar, onPago, onFechar }: {
  encomendaId: string;
  metodo: MetodoPagamento;
  telefone: string;
  montante: number;
  // Envia o pedido de pagamento (POST /api/pagamentos/iniciar)
  iniciar: () => Promise<RespostaPagamento>;
  onPago: () => void;
  onFechar: () => void;
}) {
  const info = INFO_METODO[metodo];
  const duracao = info.pinSegundos || 60;
  const [fase, setFase] = useState<Fase>('aguardar');
  const [restante, setRestante] = useState(duracao);
  const [mensagem, setMensagem] = useState('');
  const terminadoRef = useRef(false);
  // O pedido de pagamento sai uma única vez, mesmo que o efeito corra duas
  // vezes (modo estrito do React em desenvolvimento)
  const enviadoRef = useRef(false);
  const pararRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef({ onPago, onFechar });
  callbacksRef.current = { onPago, onFechar };

  const concluir = () => {
    if (terminadoRef.current) return;
    terminadoRef.current = true;
    pararRef.current?.();
    callbacksRef.current.onPago();
  };

  const falhar = (msg: string) => {
    if (terminadoRef.current) return;
    pararRef.current?.();
    pararRef.current = null;
    setMensagem(msg);
    setFase('falhado');
  };

  // Última confirmação com a operadora antes de dar o tempo por esgotado
  const verificarFinal = async () => {
    setFase('verificar');
    for (let i = 0; i < VERIFICACOES_FINAIS; i++) {
      const r = await consultarEstadoPagamento(encomendaId);
      if (terminadoRef.current) return;
      if (r?.pago) return concluir();
      if (r?.estado === 'falhado') return falhar(r.mensagem || 'O pagamento não foi concluído.');
      if (i < VERIFICACOES_FINAIS - 1) await new Promise(res => setTimeout(res, INTERVALO_VERIFICACAO_MS));
    }
    if (!terminadoRef.current) setFase('expirado');
  };

  // Ao abrir: escuta a encomenda + consulta periódica, e envia o pedido
  useEffect(() => {
    terminadoRef.current = false;
    pararRef.current = aguardarPagamento(encomendaId, {
      onPago: concluir,
      onFalhado: falhar,
      // A espera de fundo (3 min) acabou; o popup já tratou do tempo do PIN
      onTimeout: () => { pararRef.current = null; },
    });

    if (enviadoRef.current) return () => { terminadoRef.current = true; pararRef.current?.(); };
    enviadoRef.current = true;
    iniciar()
      .then(r => {
        if (terminadoRef.current) return;
        if (r.status === 'succeeded') concluir();
        else if (r.status === 'redirect' && r.checkout_url) window.location.href = r.checkout_url;
        // 'pending': continua à espera (escuta + consulta já a correr)
      })
      .catch(err => falhar(err instanceof Error ? err.message : 'Erro ao iniciar pagamento'));

    return () => { terminadoRef.current = true; pararRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contagem do tempo para introduzir o PIN
  useEffect(() => {
    if (fase !== 'aguardar') return;
    const inicio = Date.now();
    const total = restante;
    const t = setInterval(() => {
      const r = Math.max(0, total - Math.floor((Date.now() - inicio) / 1000));
      setRestante(r);
      if (r === 0) { clearInterval(t); verificarFinal(); }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // Impede o scroll da página por trás do popup
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const fechar = () => {
    terminadoRef.current = true;
    pararRef.current?.();
    callbacksRef.current.onFechar();
  };

  // "Verificar outra vez" no ecrã de tempo esgotado: volta a escutar
  // (pode ter confirmado tarde) e repete a verificação final
  const verificarDeNovo = () => {
    terminadoRef.current = false;
    pararRef.current?.();
    pararRef.current = aguardarPagamento(encomendaId, { onPago: concluir, onFalhado: falhar, onTimeout: () => {} });
    verificarFinal();
  };

  const mins = Math.floor(restante / 60);
  const secs = restante % 60;
  const raio = 22;
  const perimetro = 2 * Math.PI * raio;
  const progresso = restante / duracao;
  const urgente = fase === 'aguardar' && restante <= 15;

  const passos = [
    { icon: <Smartphone size={16} strokeWidth={1.8} />, texto: 'Desbloqueia o telemóvel e abre a notificação' },
    { icon: <KeyRound size={16} strokeWidth={1.8} />, texto: `Introduz o teu PIN ${info.nome}` },
    { icon: <CheckCircle2 size={16} strokeWidth={1.8} />, texto: 'Confirma e aguarda aqui — tratamos do resto' },
  ];

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true" aria-labelledby="pin-titulo">
      <div className="pin-modal" style={{ '--mp-cor': info.cor, '--mp-fundo': info.fundo } as React.CSSProperties}>
        <div className="pin-topo">
          <MetodoPagamentoLogo metodo={metodo} altura={52} />
        </div>

        {(fase === 'aguardar' || fase === 'verificar') && (
          <>
            <div className="pin-telefone" aria-hidden="true">
              <span className="pin-onda" />
              <span className="pin-onda pin-onda-2" />
              <div className="pin-ecra">
                <div className="pin-pontos"><span /><span /><span /><span /></div>
              </div>
            </div>

            <h2 id="pin-titulo" className="pin-titulo">
              {fase === 'aguardar' ? 'Confirma no teu telemóvel' : 'A confirmar o pagamento…'}
            </h2>
            <p className="pin-texto">
              Enviámos um pedido de <strong>{montante.toFixed(2)} MZN</strong> para o número{' '}
              <strong style={{ whiteSpace: 'nowrap' }}>{formatarTelefone(telefone)}</strong>.
            </p>

            {fase === 'aguardar' && (
              <ol className="pin-passos">
                {passos.map((p, i) => (
                  <li key={i}><span className="pin-passo-icone">{p.icon}</span><span>{p.texto}</span></li>
                ))}
              </ol>
            )}

            <div className={`pin-estado${urgente ? ' urgente' : ''}`} aria-live="polite">
              {fase === 'aguardar' ? (
                <svg width="52" height="52" viewBox="0 0 52 52" aria-label={`${restante} segundos para introduzir o PIN`}>
                  <circle cx="26" cy="26" r={raio} fill="none" stroke="var(--gray-200)" strokeWidth="4" />
                  <circle
                    cx="26" cy="26" r={raio} fill="none" stroke={urgente ? 'var(--red)' : info.cor} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - progresso)}
                    transform="rotate(-90 26 26)" style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                  <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--black)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {mins}:{secs.toString().padStart(2, '0')}
                  </text>
                </svg>
              ) : (
                <Loader2 size={28} strokeWidth={2} style={{ animation: 'spin 1s linear infinite', color: info.cor, flexShrink: 0 }} />
              )}
              <div>
                <div className="pin-estado-titulo">
                  {fase === 'aguardar'
                    ? (urgente ? 'Restam poucos segundos para o PIN' : 'Tempo para introduzires o PIN')
                    : 'A verificar com a operadora'}
                </div>
                <div className="pin-estado-sub">
                  {fase === 'aguardar'
                    ? 'Verificamos o pagamento automaticamente. Não feches esta página.'
                    : 'Isto demora só alguns segundos.'}
                </div>
              </div>
            </div>

            <button type="button" className="btn btn-outline btn-full" onClick={fechar}>Cancelar</button>
            <p className="pin-rodape">Não recebeste a notificação? Cancela e tenta de novo.</p>
          </>
        )}

        {fase === 'expirado' && (
          <div className="pin-resultado">
            <div className="pin-resultado-icone aviso"><Clock size={26} strokeWidth={1.8} /></div>
            <h2 id="pin-titulo" className="pin-titulo">Não recebemos a confirmação a tempo</h2>
            <p className="pin-texto">
              O tempo para introduzir o PIN {info.nome} terminou e o pagamento de{' '}
              <strong>{montante.toFixed(2)} MZN</strong> não foi confirmado.
            </p>
            <ul className="pin-causas">
              <li>O PIN não foi introduzido a tempo</li>
              <li>A notificação não chegou ao telemóvel (sem rede ou número errado)</li>
              <li>Saldo insuficiente na conta {info.nome}</li>
            </ul>
            <p className="pin-aviso">
              Se já introduziste o PIN e o valor saiu da tua conta, carrega em <strong>Verificar outra vez</strong> antes de tentar de novo.
            </p>
            <div className="pin-resultado-acoes">
              <button type="button" className="btn btn-primary btn-full" onClick={verificarDeNovo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <RefreshCw size={15} strokeWidth={2} /> Verificar outra vez
              </button>
              <button type="button" className="btn btn-outline btn-full" onClick={fechar}>Tentar de novo</button>
            </div>
          </div>
        )}

        {fase === 'falhado' && (
          <div className="pin-resultado">
            <div className="pin-resultado-icone erro"><XCircle size={26} strokeWidth={1.8} /></div>
            <h2 id="pin-titulo" className="pin-titulo">Pagamento não concluído</h2>
            <p className="pin-texto">{mensagem || `A ${info.nome} recusou o pagamento.`}</p>
            <div className="pin-resultado-acoes">
              <button type="button" className="btn btn-primary btn-full" onClick={fechar}>Tentar de novo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
