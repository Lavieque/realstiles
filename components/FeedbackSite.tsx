'use client';
import { useRef, useState } from 'react';
import { MessageSquarePlus, X, CheckCircle2 } from 'lucide-react';
import { mostrarToast } from '@/components/Toast';

const NIVEIS = ['Muito fraco', 'Fraco', 'Razoável', 'Bom', 'Excelente'];

// Botão "Feedback" do rodapé: abre um diálogo com avaliação de 1 a 5. A
// resposta vai para /api/contacto (tipo feedback), que a guarda em Contactos
// e avisa a equipa por email.
export default function FeedbackSite() {
  const ref = useRef<HTMLDialogElement>(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [a_enviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const abrir = () => { setEnviado(false); setNota(0); setComentario(''); ref.current?.showModal(); };
  const fechar = () => ref.current?.close();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota) { mostrarToast('Escolhe uma avaliação', 'error'); return; }
    setAEnviar(true);
    try {
      const r = await fetch('/api/contacto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'feedback', nota, comentario }) });
      if (!r.ok) { mostrarToast((await r.json().catch(() => ({}))).error || 'Erro ao enviar.', 'error'); return; }
      setEnviado(true);
    } catch {
      mostrarToast('Erro ao enviar. Tenta novamente.', 'error');
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <>
      <button type="button" onClick={abrir}><MessageSquarePlus size={25} strokeWidth={1.8} />Feedback</button>
      <dialog ref={ref} className="feedback-dialogo" onClick={e => { if (e.target === ref.current) fechar(); }}>
        <button type="button" className="feedback-fechar" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        {enviado ? (
          <div className="feedback-corpo" style={{ textAlign: 'center' }}>
            <CheckCircle2 size={44} strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
            <h2>Obrigado!</h2>
            <p>A tua opinião ajuda-nos a melhorar.</p>
            <button type="button" className="btn-escuro" onClick={fechar} style={{ marginTop: 16 }}>Fechar</button>
          </div>
        ) : (
          <form className="feedback-corpo" onSubmit={enviar}>
            <h2>Estamos aqui para melhorar a tua experiência.</h2>
            <p>A tua opinião é importante. Diz-nos o que pensas do nosso site.</p>
            <fieldset className="feedback-nota">
              <legend>Como te sentes em relação à tua visita ao site hoje?</legend>
              <div>
                {NIVEIS.map((n, i) => (
                  <label key={n} className={nota === i + 1 ? 'activo' : ''}>
                    <input type="radio" name="nota" value={i + 1} checked={nota === i + 1} onChange={() => setNota(i + 1)} />
                    <span className="feedback-num">{i + 1}</span>
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {nota > 0 && (
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Queres contar-nos mais? (opcional)" maxLength={2000} />
            )}
            <button type="submit" className="btn-escuro feedback-enviar" disabled={a_enviar}>{a_enviar ? 'A enviar...' : 'Partilhar com a Real Stiles'}</button>
            <small>Não incluas dados pessoais. Para falar com a equipa, usa a página de ajuda.</small>
          </form>
        )}
      </dialog>
    </>
  );
}
