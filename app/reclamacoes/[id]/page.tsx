'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { onAuthChange } from '@/lib/auth';
import { formatarData } from '@/lib/encomendas';
import { getConfig } from '@/lib/config-site';
import { normalizarEstado, estadoCor, parseEstadosConfig } from '@/lib/reclamacoes';
import type { Reclamacao, MensagemReclamacao } from '@/lib/reclamacoes';
import type { User } from 'firebase/auth';
import { Lock, ArrowLeft, Frown, Send } from 'lucide-react';
import { mostrarToast } from '@/components/Toast';

export default function ReclamacaoDetalhePage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [reclamacao, setReclamacao] = useState<Reclamacao | null | undefined>(undefined);
  const [mensagens, setMensagens] = useState<MensagemReclamacao[]>([]);
  const [estados, setEstados] = useState<string[]>(['Nova', 'Em andamento', 'Resolvida']);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getConfig().then(c => setEstados(parseEstadosConfig(c.reclamacao_estados)));
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (!u) { setReclamacao(null); return; }
      const snap = await getDoc(doc(db, 'reclamacoes', params.id));
      if (!snap.exists() || snap.data().cliente_id !== u.uid) {
        setReclamacao(null);
        return;
      }
      setReclamacao({ id: snap.id, ...snap.data() } as Reclamacao);
    });
    return unsub;
  }, [params.id]);

  useEffect(() => {
    if (!reclamacao) return;
    const unsub = onSnapshot(
      query(collection(db, 'reclamacoes', reclamacao.id, 'mensagens'), orderBy('criado_em', 'asc')),
      snap => setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() } as MensagemReclamacao)))
    );
    return unsub;
  }, [reclamacao?.id]);

  const enviarMensagem = async () => {
    if (!reclamacao || !texto.trim()) return;
    setEnviando(true);
    const conteudo = texto.trim();
    try {
      await addDoc(collection(db, 'reclamacoes', reclamacao.id, 'mensagens'), {
        autor: 'cliente',
        autor_nome: reclamacao.nome,
        texto: conteudo,
        criado_em: serverTimestamp(),
      });
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'mensagem_reclamacao_cliente',
          nome: reclamacao.nome,
          assunto: reclamacao.assunto,
          mensagem: conteudo,
        }),
      }).catch(() => {});
      setTexto('');
    } catch {
      mostrarToast('Erro ao enviar mensagem', 'error');
    } finally {
      setEnviando(false);
    }
  };

  if (user === undefined || reclamacao === undefined) {
    return <div className="page-wrapper"><div className="container"><div className="loading"><div className="spinner" /> A carregar...</div></div></div>;
  }

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon"><Lock size={40} strokeWidth={1.5} /></div>
            <h3>Acesso restrito</h3>
            <p>Tens de entrar na tua conta para ver esta reclamação.</p>
            <Link href={`/conta?redirect=/reclamacoes/${params.id}`} className="btn btn-primary" style={{ marginTop: 20 }}>Entrar</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!reclamacao) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon"><Frown size={40} strokeWidth={1.5} /></div>
            <h3>Reclamação não encontrada</h3>
            <Link href="/reclamacoes" className="btn btn-primary" style={{ marginTop: 20 }}>Voltar</Link>
          </div>
        </div>
      </div>
    );
  }

  const label = normalizarEstado(reclamacao.estado);
  const { cor, fundo } = estadoCor(label, estados);

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 640 }}>
        <Link href="/reclamacoes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-400)', textDecoration: 'none', marginBottom: 16 }}>
          <ArrowLeft size={14} strokeWidth={1.5} /> As minhas reclamações
        </Link>

        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{reclamacao.assunto}</h1>
            <p>{formatarData(reclamacao.criado_em)}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: fundo, color: cor, flexShrink: 0 }}>
            {label}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {/* Mensagem original submetida pelo cliente */}
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4, textAlign: 'right' }}>{reclamacao.nome} (tu)</div>
            <div style={{ background: 'var(--black)', color: 'white', borderRadius: '14px 4px 14px 14px', padding: '12px 16px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {reclamacao.descricao}
            </div>
          </div>

          {mensagens.map(m => (
            <div key={m.id} style={{ alignSelf: m.autor === 'admin' ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4, textAlign: m.autor === 'admin' ? 'left' : 'right' }}>
                {m.autor === 'admin' ? m.autor_nome : `${reclamacao.nome} (tu)`}
              </div>
              <div style={{
                background: m.autor === 'admin' ? 'white' : 'var(--black)',
                color: m.autor === 'admin' ? 'var(--black)' : 'white',
                border: m.autor === 'admin' ? '1px solid var(--gray-200)' : 'none',
                borderRadius: m.autor === 'admin' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                padding: '12px 16px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {m.texto}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 20, background: 'white', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 14 }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escreve uma mensagem..."
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
      </div>
    </div>
  );
}
