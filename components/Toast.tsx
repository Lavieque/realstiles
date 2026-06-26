'use client';
import { useEffect, useState } from 'react';

interface ToastEvent extends Event {
  detail: { msg: string; tipo?: string };
}

export default function Toast() {
  const [msg, setMsg] = useState('');
  const [tipo, setTipo] = useState('');
  const [show, setShow] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { msg: m, tipo: t = '' } = (e as ToastEvent).detail;
      setMsg(m);
      setTipo(t);
      setShow(true);
      if (timer) clearTimeout(timer);
      setTimer(setTimeout(() => setShow(false), 3000));
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  return (
    <div className={`toast${show ? ' show' : ''}${tipo ? ` ${tipo}` : ''}`}>
      {msg}
    </div>
  );
}

export function mostrarToast(msg: string, tipo = '') {
  window.dispatchEvent(new CustomEvent('toast', { detail: { msg, tipo } }));
}
