'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mostrarToast } from '@/components/Toast';
import { useAcessoAdmin } from '@/components/AdminGuard';
import { correspondePesquisa } from '@/lib/pesquisa';
import { getRoles, atribuirRole, definirSuperAdmin } from '@/lib/roles';
import type { Perfil } from '@/lib/auth';
import type { Role } from '@/lib/roles';
import { confirmar } from '@/components/Confirmar';

export default function AdminClientesPage() {
  const acesso = useAcessoAdmin();
  const gereRoles = acesso.tem('utilizadores');
  const [clientes, setClientes] = useState<Perfil[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    getDocs(collection(db, 'clientes')).then(snap => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Perfil)));
      setLoading(false);
    });
    getRoles().then(setRoles).catch(() => {});
  }, []);

  const actualizarLocal = (id: string, dados: Partial<Perfil>) =>
    setClientes(c => c.map(x => x.id === id ? { ...x, ...dados } : x));

  const toggleSuperAdmin = async (cliente: Perfil) => {
    const novoAdmin = !cliente.admin;
    if (!novoAdmin && cliente.id === acesso.perfil?.id && !(await confirmar({ titulo: 'Remover o teu acesso de administrador?', mensagem: 'Vais deixar de conseguir entrar no painel com esta conta.', confirmar: 'Remover', perigo: true }))) return;
    try {
      await definirSuperAdmin(cliente.id, novoAdmin);
      actualizarLocal(cliente.id, { admin: novoAdmin });
      mostrarToast(`${cliente.nome} ${novoAdmin ? 'promovido a administrador' : 'removido de administrador'}`, 'success');
    } catch {
      mostrarToast('Erro ao alterar o acesso', 'error');
    }
  };

  const mudarRole = async (cliente: Perfil, roleId: string) => {
    const novo = roleId || null;
    try {
      await atribuirRole(cliente.id, novo);
      actualizarLocal(cliente.id, { role: novo });
      const nome = roles.find(r => r.id === novo)?.nome;
      mostrarToast(nome ? `${cliente.nome}: role "${nome}" atribuída` : `${cliente.nome}: role removida`, 'success');
    } catch {
      mostrarToast('Erro ao atribuir a role', 'error');
    }
  };

  const nomeRole = (id?: string | null) => roles.find(r => r.id === id)?.nome;

  const filtrados = clientes.filter(c =>
    correspondePesquisa(filtro, [c.id, c.nome, c.email, c.telefone, c.morada, nomeRole(c.role)])
  );

  return (
    <>
      <div className="admin-topbar">
        <h1>Clientes</h1>
        <span style={{ fontSize: 14, color: 'var(--gray-400)' }}>{clientes.length} registados</span>
      </div>
      <div className="admin-content">
        <div style={{ marginBottom: 20 }}>
          <input placeholder="Pesquisar por nome, email, telefone ou role..." value={filtro} onChange={e => setFiltro(e.target.value)}
            style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
        {gereRoles && (
          <div style={{ background: '#eaf1fb', border: '1px solid #c7d8f2', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#2c5aa0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>
              {roles.length === 0
                ? 'Ainda não há roles. Cria uma role e escolhe os menus a que dá acesso; depois atribui-a aqui na coluna "Acesso ao painel".'
                : 'Para dar acesso só a alguns menus, escolhe uma role na coluna "Acesso ao painel". Os menus de cada role definem-se em Roles e permissões.'}
            </span>
            <Link href="/admin/roles" className="btn btn-primary btn-sm">{roles.length === 0 ? 'Criar role' : 'Gerir roles'}</Link>
          </div>
        )}
        <div className="table-card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Acesso ao painel</th>{acesso.superAdmin && <th></th>}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5}><div className="loading"><div className="spinner" /></div></td></tr> :
                  filtrados.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.nome || '—'}</td>
                      <td>{c.email}</td>
                      <td>{c.telefone || '—'}</td>
                      <td>
                        {c.admin ? (
                          <span style={{ color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} strokeWidth={1.5} /> Administrador</span>
                        ) : gereRoles ? (
                          <select value={c.role || ''} onChange={e => mudarRole(c, e.target.value)} style={{ padding: '6px 10px', fontSize: 13, minWidth: 160 }}>
                            <option value="">Sem acesso</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                            {c.role && !nomeRole(c.role) && <option value={c.role}>Role apagada</option>}
                          </select>
                        ) : (
                          <span style={{ color: nomeRole(c.role) ? 'var(--gray-800)' : 'var(--gray-400)' }}>{nomeRole(c.role) || '—'}</span>
                        )}
                      </td>
                      {acesso.superAdmin && (
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => toggleSuperAdmin(c)} title="Administrador tem acesso a todos os menus. Para acesso parcial, atribui uma role.">
                            {c.admin ? 'Remover acesso total' : 'Dar acesso total'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
