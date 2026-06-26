'use client';
import { useState } from 'react';
import { mostrarToast } from '@/components/Toast';

export default function ReclamacaoPage() {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', assunto: '', descricao: '' });
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'reclamacao', ...form }),
      });
      setEnviado(true);
      mostrarToast('Reclamação enviada com sucesso!', 'success');
    } catch {
      mostrarToast('Erro ao enviar. Tenta novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <h1>Livro de Reclamações</h1>
          <p>Prezamos pela sua satisfação. Responderemos no prazo de 3 dias úteis.</p>
        </div>

        {enviado ? (
          <div style={{ background: 'var(--green)', color: 'white', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>✅</p>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Reclamação recebida</h2>
            <p style={{ opacity: 0.9 }}>Analisaremos o seu caso e responderemos em breve.</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 32 }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label>Nome *</label><input required value={form.nome} onChange={f('nome')} /></div>
                <div className="form-group"><label>Email *</label><input type="email" required value={form.email} onChange={f('email')} /></div>
              </div>
              <div className="form-group"><label>Telefone</label><input value={form.telefone} onChange={f('telefone')} /></div>
              <div className="form-group">
                <label>Assunto *</label>
                <select required value={form.assunto} onChange={f('assunto')}>
                  <option value="">Selecciona...</option>
                  <option>Produto com defeito</option>
                  <option>Entrega atrasada</option>
                  <option>Produto diferente do pedido</option>
                  <option>Atendimento</option>
                  <option>Outro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descrição *</label>
                <textarea required value={form.descricao} onChange={f('descricao')} placeholder="Descreve o problema em detalhe..." style={{ minHeight: 140 }} />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? 'A enviar...' : 'Submeter reclamação'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
