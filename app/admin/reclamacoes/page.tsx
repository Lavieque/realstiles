'use client';
import { useEffect, useState, useRef } from 'react';
import { Mail, User, Send } from 'lucide-react';
import { getDocs, collection, doc, updateDoc, addDoc, orderBy, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { onAuthChange, getPerfil } from '@/lib/auth';
import { formatarData } from '@/lib/encomendas';
import { mostrarToast } from '@/components/Toast';

type Estado = 'nova' | 'em_andamento' | 'resolvida';

const ESTADO_META: Record<Estado, { label: string; cor: string; fundo: string }> = {
  nova:         { label: 'Nova',         cor: '#c0392b', fundo: '#fdecea' },
  em_andamento: { label: 'Em andamento', cor: '#b8860b', fundo: '#fff8e1' },
  resolvida:    { label: 'Resolvida',    cor: '#1a8c5a', fundo: '#e6f9f0' },
};

interface Reclamacao {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  assunto: string;
  descricao: string;
  notif_canal?: 'email' | 'whatsapp';
  criado_em?: unknown;
  respondida?: boolean;
  estado?: Estado;
}

interface Mensagem {
  id: string;
  autor: 'cliente' | 'admin';
  autor_nome: string;
  texto: string;
  criado_em?: unknown;
}

function EstadoBadge({ estado }: { estado?: Estado }) {
  const meta = ESTADO_META[estado ?? 'nova'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: meta.fundo, color: meta.cor }}>
      {meta.label}
    </span>
  );
}

export default function AdminReclamacoesPage() {
  const [reclamacoes, setReclamacoes] = useState<Reclamacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Reclamacao | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [adminNome, setAdminNome] = useState('Admin');
  const mensagensFimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onAuthChange(async u => {
      if (!u) return;
      const perfil = await getPerfil(u.uid);
      setAdminNome(perfil?.nome || 'Admin');
    });
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, 'reclamacoes'), orderBy('criado_em', 'desc')))
      .then(snap => {
        setReclamacoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reclamacao)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Chat em tempo real da reclamação seleccionada
  useEffect(() => {
    if (!sel) { setMensagens([]); return; }
    const unsub = onSnapshot(
      query(collection(db, 'reclamacoes', sel.id, 'mensagens'), orderBy('criado_em', 'asc')),
      snap => setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mensagem)))
    );
    return unsub;
  }, [sel?.id]);

  useEffect(() => {
    mensagensFimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const seleccionar = (r: Reclamacao) => {
    setSel(r);
    setTexto('');
  };

  const actualizarEstadoLocal = (id: string, patch: Partial<Reclamacao>) => {
    setReclamacoes(rs => rs.map(x => x.id === id ? { ...x, ...patch } : x));
    setSel(s => s && s.id === id ? { ...s, ...patch } : s);
  };

  const mudarEstado = async (estado: Estado) => {
    if (!sel) return;
    await updateDoc(doc(db, 'reclamacoes', sel.id), { estado });
    actualizarEstadoLocal(sel.id, { estado });
  };

  const enviarMensagem = async () => {
    if (!sel || !texto.trim()) return;
    setEnviando(true);
    const conteudo = texto.trim();
    try {
      await addDoc(collection(db, 'reclamacoes', sel.id, 'mensagens'), {
        autor: 'admin',
        autor_nome: adminNome,
        texto: conteudo,
        criado_em: serverTimestamp(),
      });

      // Notifica o cliente pelo canal registado, tal como na primeira resposta
      if (sel.notif_canal === 'whatsapp') {
        const telLimpo = sel.telefone?.replace(/\D/g, '') || '';
        if (telLimpo) {
          await fetch('/api/notify/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telefone: telLimpo,
              mensagem: `✉️ *Resposta à sua reclamação*\n\n*Assunto:* ${sel.assunto}\n\n${conteudo}\n\n— Real Stiles`,
            }),
          });
        }
      } else if (sel.email) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'resposta_reclamacao',
            cliente_email: sel.email,
            assunto: sel.assunto,
            resposta: conteudo,
          }),
        });
      }

      const novoEstado: Estado = sel.estado === 'resolvida' ? 'em_andamento' : (sel.estado ?? 'em_andamento');
      await updateDoc(doc(db, 'reclamacoes', sel.id), { respondida: true, estado: novoEstado });
      actualizarEstadoLocal(sel.id, { respondida: true, estado: novoEstado });
      setTexto('');
      mostrarToast('Mensagem enviada!', 'success');
    } catch {
      mostrarToast('Erro ao enviar mensagem', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 380, borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div className="admin-topbar" style={{ position: 'sticky', top: 0 }}><h1>Reclamações</h1></div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> :
            reclamacoes.length === 0 ? <div className="empty-state"><div className="icon"><Mail size={40} strokeWidth={1.5} /></div><h3>Sem reclamações</h3></div> :
            reclamacoes.map(r => (
              <div key={r.id} onClick={() => seleccionar(r)} style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', background: sel?.id === r.id ? 'var(--gray-100)' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{r.nome}</p>
                  <EstadoBadge estado={r.estado} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 2 }}>{r.assunto}</p>
                <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatarData(r.criado_em)}</p>
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8f8f6' }}>
        {!sel ? (
          <div className="empty-state" style={{ paddingTop: 120 }}>
            <div className="icon"><Mail size={40} strokeWidth={1.5} /></div>
            <h3>Selecciona uma reclamação</h3>
          </div>
        ) : (
          <>
            {/* Cabeçalho com detalhes e estado */}
            <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '20px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{sel.assunto}</h2>
                  <p style={{ fontSize: 13, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} strokeWidth={1.5} /> {sel.nome} · {sel.email || sel.telefone}
                  </p>
                </div>
                <select
                  value={sel.estado ?? 'nova'}
                  onChange={e => mudarEstado(e.target.value as Estado)}
                  style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--gray-200)', background: 'white', cursor: 'pointer' }}
                >
                  {(Object.keys(ESTADO_META) as Estado[]).map(e => (
                    <option key={e} value={e}>{ESTADO_META[e].label}</option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatarData(sel.criado_em)}</p>
            </div>

            {/* Thread de mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Mensagem original do cliente, sempre a primeira bolha */}
              <div style={{ alignSelf: 'flex-start', maxWidth: 480 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>{sel.nome}</div>
                <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '4px 14px 14px 14px', padding: '12px 16px', fontSize: 14, lineHeight: 1.6 }}>
                  {sel.descricao}
                </div>
              </div>

              {mensagens.map(m => (
                <div key={m.id} style={{ alignSelf: m.autor === 'admin' ? 'flex-end' : 'flex-start', maxWidth: 480 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4, textAlign: m.autor === 'admin' ? 'right' : 'left' }}>
                    {m.autor === 'admin' ? m.autor_nome : sel.nome}
                  </div>
                  <div style={{
                    background: m.autor === 'admin' ? 'var(--black)' : 'white',
                    color: m.autor === 'admin' ? 'white' : 'var(--black)',
                    border: m.autor === 'admin' ? 'none' : '1px solid var(--gray-200)',
                    borderRadius: m.autor === 'admin' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    padding: '12px 16px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  }}>
                    {m.texto}
                  </div>
                </div>
              ))}
              <div ref={mensagensFimRef} />
            </div>

            {/* Composer — sempre visível, sem bloquear após a primeira resposta */}
            <div style={{ background: 'white', borderTop: '1px solid var(--gray-200)', padding: '16px 32px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder={`Escreve uma mensagem para ${sel.nome}...`}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', minHeight: 44, maxHeight: 140, outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                className="btn btn-primary"
                onClick={enviarMensagem}
                disabled={enviando || !texto.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                {enviando ? 'A enviar...' : <><Send size={14} strokeWidth={1.5} /> Enviar</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
