'use client';
import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mostrarToast } from '@/components/Toast';
import { PERMISSOES } from '@/lib/permissoes';
import { getRoles, criarRole, actualizarRole, apagarRole } from '@/lib/roles';
import type { Role } from '@/lib/roles';
import type { Permissao } from '@/lib/permissoes';

interface Formulario {
  id: string | null;
  nome: string;
  descricao: string;
  permissoes: Set<Permissao>;
}

const VAZIO: Formulario = { id: null, nome: '', descricao: '', permissoes: new Set() };

const LABEL = Object.fromEntries(PERMISSOES.map(p => [p.chave, p.label])) as Record<Permissao, string>;

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [membros, setMembros] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const [lista, clientes] = await Promise.all([getRoles(), getDocs(collection(db, 'clientes'))]);
    const contagem: Record<string, number> = {};
    clientes.docs.forEach(d => {
      const r = d.data().role;
      if (r) contagem[r] = (contagem[r] || 0) + 1;
    });
    setRoles(lista);
    setMembros(contagem);
    setLoading(false);
  };

  useEffect(() => {
    carregar().catch(() => { setLoading(false); mostrarToast('Erro ao carregar roles', 'error'); });
  }, []);

  const editar = (r: Role) => setForm({ id: r.id, nome: r.nome, descricao: r.descricao, permissoes: new Set(r.permissoes) });

  const alternar = (p: Permissao) => setForm(f => {
    if (!f) return f;
    const permissoes = new Set(f.permissoes);
    if (permissoes.has(p)) permissoes.delete(p); else permissoes.add(p);
    return { ...f, permissoes };
  });

  const guardar = async () => {
    if (!form || !form.nome.trim()) return;
    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      permissoes: PERMISSOES.map(p => p.chave).filter(c => form.permissoes.has(c)),
    };
    try {
      if (form.id) await actualizarRole(form.id, dados);
      else await criarRole(dados);
      mostrarToast(form.id ? 'Role actualizada' : 'Role criada', 'success');
      setForm(null);
      await carregar();
    } catch {
      mostrarToast('Erro ao guardar a role', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (r: Role) => {
    const n = membros[r.id] || 0;
    const aviso = n > 0
      ? `A role "${r.nome}" está atribuída a ${n} utilizador(es), que vão perder o acesso ao painel. Apagar mesmo assim?`
      : `Apagar a role "${r.nome}"?`;
    if (!confirm(aviso)) return;
    try {
      await apagarRole(r.id);
      mostrarToast('Role apagada', 'success');
      await carregar();
    } catch {
      mostrarToast('Erro ao apagar a role', 'error');
    }
  };

  return (
    <div className="admin-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', maxWidth: 560 }}>
          Cada role define as funcionalidades do painel a que os seus membros têm acesso.
          Atribui roles aos utilizadores na página Clientes. Os administradores têm sempre acesso a tudo.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...VAZIO, permissoes: new Set() })} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} strokeWidth={1.5} /> Nova role
        </button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : roles.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 32, textAlign: 'center', color: 'var(--gray-500)', fontSize: 14 }}>
          Ainda não há roles. Cria uma, por exemplo &quot;Gestor de catálogo&quot; com acesso a Produtos.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roles.map(r => (
            <div key={r.id} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {r.nome}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gray-400)', marginLeft: 8 }}>
                      {membros[r.id] || 0} membro(s)
                    </span>
                  </div>
                  {r.descricao && <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{r.descricao}</div>}
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => editar(r)} aria-label="Editar" style={{ display: 'flex', alignItems: 'center' }}><Pencil size={14} strokeWidth={1.5} /></button>
                <button className="btn btn-outline btn-sm" onClick={() => remover(r)} aria-label="Apagar" style={{ display: 'flex', alignItems: 'center', color: 'var(--red)' }}><Trash2 size={14} strokeWidth={1.5} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {r.permissoes.length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Sem permissões</span>
                  : r.permissoes.map(p => (
                    <span key={p} style={{ fontSize: 12, background: 'var(--gray-100)', color: 'var(--gray-800)', borderRadius: 100, padding: '3px 10px' }}>{LABEL[p]}</span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`modal-overlay${form ? ' open' : ''}`} onClick={() => !salvando && setForm(null)}>
        <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
          {form && (
            <>
              <div className="modal-header">
                <h2>{form.id ? 'Editar role' : 'Nova role'}</h2>
                <button className="modal-close" onClick={() => setForm(null)} aria-label="Fechar"><X size={16} strokeWidth={1.5} /></button>
              </div>
              <div className="form-group">
                <label>Nome</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Gestor de catálogo" autoFocus />
              </div>
              <div className="form-group">
                <label>Descrição (opcional)</label>
                <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Adiciona e edita artigos" />
              </div>
              <div className="form-group">
                <label>Funcionalidades</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {PERMISSOES.map(p => (
                    <label key={p.chave} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--gray-200)', cursor: 'pointer', fontWeight: 400 }}>
                      <input type="checkbox" checked={form.permissoes.has(p.chave)} onChange={() => alternar(p.chave)} style={{ width: 'auto', marginTop: 3 }} />
                      <span>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{p.label}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-500)' }}>{p.descricao}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={salvando}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={guardar} disabled={salvando || !form.nome.trim()}>{salvando ? 'A guardar...' : 'Guardar'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
