'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

// Diálogo de confirmação do site, em vez do confirm() nativo do browser.
// Montado uma vez no layout (como o Toast) e chamado com:
//   if (!(await confirmar({ titulo: '…', mensagem: '…' }))) return;

export interface OpcoesConfirmar {
  titulo: string;
  mensagem?: string;
  confirmar?: string;
  cancelar?: string;
  // Acção destrutiva ou arriscada: botão vermelho e ícone de aviso
  perigo?: boolean;
}

interface PedidoConfirmar extends OpcoesConfirmar {
  responder: (ok: boolean) => void;
}

const EVENTO = 'rs-confirmar';

export function confirmar(opcoes: OpcoesConfirmar | string): Promise<boolean> {
  const op = typeof opcoes === 'string' ? { titulo: opcoes } : opcoes;
  return new Promise(responder => {
    window.dispatchEvent(new CustomEvent<PedidoConfirmar>(EVENTO, { detail: { ...op, responder } }));
  });
}

export default function Confirmar() {
  const [pedido, setPedido] = useState<PedidoConfirmar | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const novo = (e as CustomEvent<PedidoConfirmar>).detail;
      // Um pedido novo cancela o anterior, para nenhuma promessa ficar pendurada
      setPedido(anterior => { anterior?.responder(false); return novo; });
    };
    window.addEventListener(EVENTO, handler);
    return () => window.removeEventListener(EVENTO, handler);
  }, []);

  useEffect(() => {
    if (!pedido) return;
    botaoRef.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') responder(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (!pedido) return null;

  function responder(ok: boolean) {
    pedido?.responder(ok);
    setPedido(null);
  }

  const Icone = pedido.perigo ? AlertTriangle : HelpCircle;

  return (
    <div className="conf-overlay" onClick={() => responder(false)}>
      <div
        className={`conf-dialogo${pedido.perigo ? ' perigo' : ''}`}
        role="alertdialog" aria-modal="true" aria-labelledby="conf-titulo" aria-describedby="conf-mensagem"
        onClick={e => e.stopPropagation()}
      >
        <div className="conf-icone"><Icone size={22} strokeWidth={1.8} /></div>
        <h3 id="conf-titulo">{pedido.titulo}</h3>
        {pedido.mensagem && <p id="conf-mensagem">{pedido.mensagem}</p>}
        <div className="conf-acoes">
          <button type="button" className="btn btn-outline" onClick={() => responder(false)}>
            {pedido.cancelar ?? 'Cancelar'}
          </button>
          <button
            ref={botaoRef}
            type="button"
            className={`btn ${pedido.perigo ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => responder(true)}
          >
            {pedido.confirmar ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
