'use client';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { mostrarToast } from '@/components/Toast';

// Formulário da página /ajuda. Envia para /api/contacto, que guarda a
// mensagem e avisa a equipa por email.
export default function FormContacto() {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', assunto: '', mensagem: '' });
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }));

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch('/api/contacto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { mostrarToast(d.error || 'Erro ao enviar. Tenta novamente.', 'error'); return; }
      setEnviado(true);
    } catch {
      mostrarToast('Erro ao enviar. Tenta novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckCircle2 size={44} strokeWidth={1.5} /></div>
        <h3 style={{ marginBottom: 6 }}>Mensagem enviada</h3>
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>A equipa responde assim que possível.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submeter} style={{ maxWidth: 640 }}>
      <div className="form-grid-2">
        <div className="form-group"><label>Nome *</label><input required value={form.nome} onChange={f('nome')} /></div>
        <div className="form-group"><label>Assunto</label><input value={form.assunto} onChange={f('assunto')} placeholder="Ex: Dúvida sobre uma encomenda" /></div>
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={f('email')} placeholder="o-teu@email.com" /></div>
        <div className="form-group"><label>Telefone</label><input value={form.telefone} onChange={f('telefone')} /></div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '-4px 0 12px' }}>Indica pelo menos um email ou telefone para te responder.</p>
      <div className="form-group"><label>Mensagem *</label><textarea required value={form.mensagem} onChange={f('mensagem')} style={{ minHeight: 130 }} /></div>
      <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'A enviar...' : 'Enviar mensagem'}</button>
    </form>
  );
}
