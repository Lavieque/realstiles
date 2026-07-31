'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { mostrarToast } from '@/components/Toast';
import { onAuthChange, getPerfil } from '@/lib/auth';
import type { User } from 'firebase/auth';

export default function ReclamacaoPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [notifCanal, setNotifCanal] = useState<'email' | 'whatsapp'>('email');
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', assunto: '', descricao: '' });
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    return onAuthChange(async u => {
      setUser(u);
      if (!u) return;
      const perfil = await getPerfil(u.uid);
      const canal = perfil?.notif_canal ?? 'email';
      setNotifCanal(canal);
      if (canal === 'whatsapp') {
        // pré-preenche telefone do perfil ou do uid
        const tel = perfil?.telefone || (u.uid.startsWith('wa_') ? u.uid.replace('wa_', '') : '');
        setForm(f => ({ ...f, nome: perfil?.nome || f.nome, telefone: tel }));
      } else {
        setForm(f => ({ ...f, nome: perfil?.nome || f.nome, email: u.email || f.email }));
      }
    });
  }, []);

  const isWa = notifCanal === 'whatsapp';

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Guarda em Firestore com o canal do utilizador para o admin poder responder pelo canal certo
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await addDoc(collection(db, 'reclamacoes'), {
        ...form,
        cliente_id: user?.uid || null,
        notif_canal: isWa ? 'whatsapp' : 'email',
        respondida: false,
        criado_em: serverTimestamp(),
      });

      // Notifica admin por email sempre (o admin usa email)
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'reclamacao', ...form }),
      }).catch(() => {});

      // Acuse de recepção ao cliente pelo canal correto
      if (isWa) {
        const tel = form.telefone.replace(/\D/g, '');
        if (tel) {
          fetch('/api/notify/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telefone: tel,
              mensagem: `✅ *Reclamação recebida*\n\nRecebemos a sua reclamação sobre "${form.assunto}".\nA nossa equipa responderá no prazo de 3 dias úteis.`,
            }),
          }).catch(() => {});
        }
      }

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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckCircle2 size={56} strokeWidth={1.5} /></div>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Reclamação recebida</h2>
            <p style={{ opacity: 0.9 }}>Analisaremos o seu caso e responderemos em breve.</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', padding: 32 }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label>Nome *</label><input required value={form.nome} onChange={f('nome')} /></div>
                {!isWa && (
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" required value={form.email} onChange={f('email')} placeholder="o-teu@email.com" />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Telefone{isWa ? ' *' : ''}</label>
                <input required={isWa} value={form.telefone} onChange={f('telefone')} />
              </div>
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
              {isWa && (
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
                  A resposta será enviada pelo WhatsApp.
                </p>
              )}
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
