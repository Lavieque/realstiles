'use client';
import { useEffect, useState } from 'react';
import { getDocs, collection, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatarData } from '@/lib/encomendas';
import { mostrarToast } from '@/components/Toast';

interface Reclamacao {
  id: string;
  nome: string;
  email: string;
  assunto: string;
  descricao: string;
  criado_em?: unknown;
  respondida?: boolean;
}

export default function AdminReclamacoesPage() {
  const [reclamacoes, setReclamacoes] = useState<Reclamacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Reclamacao | null>(null);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, 'reclamacoes'), orderBy('criado_em', 'desc')))
      .then(snap => {
        setReclamacoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reclamacao)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const seleccionar = (r: Reclamacao) => {
    setSel(r);
    setResposta('');
  };

  const enviarResposta = async () => {
    if (!sel || !resposta.trim()) return;
    setEnviando(true);
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'resposta_reclamacao',
          cliente_email: sel.email,
          assunto: sel.assunto,
          resposta: resposta.trim(),
        }),
      });
      await updateDoc(doc(db, 'reclamacoes', sel.id), { respondida: true });
      setReclamacoes(r => r.map(x => x.id === sel.id ? { ...x, respondida: true } : x));
      setSel(s => s ? { ...s, respondida: true } : s);
      setResposta('');
      mostrarToast('Resposta enviada com sucesso!', 'success');
    } catch {
      mostrarToast('Erro ao enviar resposta', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const marcarRespondida = async () => {
    if (!sel) return;
    await updateDoc(doc(db, 'reclamacoes', sel.id), { respondida: true });
    setReclamacoes(r => r.map(x => x.id === sel.id ? { ...x, respondida: true } : x));
    setSel(s => s ? { ...s, respondida: true } : s);
    mostrarToast('Marcada como respondida', 'success');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 380, borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div className="admin-topbar" style={{ position: 'sticky', top: 0 }}><h1>Reclamações</h1></div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> :
            reclamacoes.length === 0 ? <div className="empty-state"><div className="icon">✉️</div><h3>Sem reclamações</h3></div> :
            reclamacoes.map(r => (
              <div key={r.id} onClick={() => seleccionar(r)} style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', background: sel?.id === r.id ? 'var(--gray-100)' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{r.nome}</p>
                  {r.respondida && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Respondida</span>}
                </div>
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 2 }}>{r.assunto}</p>
                <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatarData(r.criado_em)}</p>
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f8f6', padding: 32 }}>
        {!sel ? (
          <div className="empty-state" style={{ paddingTop: 120 }}>
            <div className="icon">✉️</div>
            <h3>Selecciona uma reclamação</h3>
          </div>
        ) : (
          <div style={{ maxWidth: 620 }}>
            {/* Detalhes da reclamação */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{sel.assunto}</h2>
              <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 4 }}>👤 {sel.nome} · {sel.email}</p>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>{formatarData(sel.criado_em)}</p>
              <p style={{ fontSize: 14, color: 'var(--gray-800)', lineHeight: 1.7, background: 'var(--gray-100)', borderRadius: 8, padding: 16 }}>{sel.descricao}</p>
            </div>

            {/* Responder */}
            {!sel.respondida ? (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Responder ao cliente</h3>
                <textarea
                  value={resposta}
                  onChange={e => setResposta(e.target.value)}
                  placeholder={`Escreve uma resposta para ${sel.nome}...`}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', minHeight: 120, outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    className="btn btn-primary"
                    onClick={enviarResposta}
                    disabled={enviando || !resposta.trim()}
                  >
                    {enviando ? 'A enviar...' : '✉️ Enviar resposta'}
                  </button>
                  <button className="btn btn-outline" onClick={marcarRespondida} disabled={enviando}>
                    Marcar como respondida
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: '#f0f7f0', borderRadius: 12, border: '1px solid #c3e6cb', padding: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>✓ Reclamação respondida</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
