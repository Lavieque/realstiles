'use client';
import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mostrarToast } from '@/components/Toast';
import { confirmar } from '@/components/Confirmar';
import { Trash2, MailOpen } from 'lucide-react';

// Mensagens do formulário de contacto (/ajuda) e os dois emails que as recebem.
// Mensagens: colecção `contactos`; destinatários: config/contactos.emails.
interface Contacto {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  assunto: string;
  referencia?: string;
  mensagem: string;
  lida: boolean;
  criado_em?: { toDate?: () => Date } | null;
}

const formatar = (c: Contacto) => c.criado_em?.toDate?.().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) || '';

export default function AdminContactosPage() {
  const [emails, setEmails] = useState<[string, string]>(['', '']);
  const [mensagens, setMensagens] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, 'config', 'contactos')),
      getDocs(query(collection(db, 'contactos'), orderBy('criado_em', 'desc'))),
    ])
      .then(([cfg, snap]) => {
        const e = (cfg.data()?.emails || []) as string[];
        setEmails([e[0] || '', e[1] || '']);
        setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Contacto));
      })
      .catch(() => mostrarToast('Erro ao carregar', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const guardarEmails = async () => {
    const limpos = emails.map(e => e.trim()).filter(Boolean);
    if (limpos.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) { mostrarToast('Email inválido', 'error'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'config', 'contactos'), { emails: limpos });
      mostrarToast('Destinatários guardados!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const marcarLida = async (c: Contacto) => {
    try {
      await updateDoc(doc(db, 'contactos', c.id), { lida: !c.lida });
      setMensagens(m => m.map(x => x.id === c.id ? { ...x, lida: !c.lida } : x));
    } catch {
      mostrarToast('Erro ao actualizar', 'error');
    }
  };

  const remover = async (c: Contacto) => {
    if (!(await confirmar({ titulo: `Apagar a mensagem de ${c.nome}?`, confirmar: 'Apagar', perigo: true }))) return;
    try {
      await deleteDoc(doc(db, 'contactos', c.id));
      setMensagens(m => m.filter(x => x.id !== c.id));
    } catch {
      mostrarToast('Erro ao apagar', 'error');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /> A carregar...</div>;

  const porLer = mensagens.filter(m => !m.lida).length;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 32 }}>
      <div className="admin-topbar" style={{ marginBottom: 24 }}>
        <h1>Contactos{porLer > 0 ? ` (${porLer} por ler)` : ''}</h1>
      </div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <h2>Quem recebe os emails</h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
          Cada mensagem do formulário de contacto é enviada para os dois endereços. Fica sempre guardada aqui.
        </p>
        <div className="form-grid-2">
          <div className="form-group"><label>Email 1</label><input type="email" value={emails[0]} onChange={e => setEmails([e.target.value, emails[1]])} placeholder="geral@realstiles.co.mz" /></div>
          <div className="form-group"><label>Email 2</label><input type="email" value={emails[1]} onChange={e => setEmails([emails[0], e.target.value])} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={guardarEmails} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar destinatários'}</button>
        </div>
      </div>

      {mensagens.length === 0 ? (
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Ainda não há mensagens.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mensagens.map(c => (
            <div key={c.id} style={{ background: 'white', border: '1px solid var(--gray-200)', borderLeft: c.lida ? '1px solid var(--gray-200)' : '3px solid var(--black)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{c.nome}{c.assunto ? ` — ${c.assunto}` : ''}</p>
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '2px 0 8px' }}>
                    {[formatar(c), c.email, c.telefone, c.referencia && `Ref. ${c.referencia}`].filter(Boolean).join(' · ')}
                  </p>
                  <p style={{ fontSize: 14, margin: 0, whiteSpace: 'pre-wrap' }}>{c.mensagem}</p>
                  {c.email && <p style={{ margin: '10px 0 0' }}><a href={`mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.assunto || 'A tua mensagem'}`)}`} style={{ fontSize: 13, fontWeight: 600 }}>Responder por email</a></p>}
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => marcarLida(c)} aria-label={c.lida ? 'Marcar como por ler' : 'Marcar como lida'} title={c.lida ? 'Marcar como por ler' : 'Marcar como lida'}><MailOpen size={14} /></button>
                <button className="btn btn-outline btn-sm" onClick={() => remover(c)} aria-label="Apagar"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
