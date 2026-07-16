'use client';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mostrarToast } from '@/components/Toast';
import type { Perfil } from '@/lib/auth';

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    getDocs(collection(db, 'clientes')).then(snap => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Perfil)));
      setLoading(false);
    });
  }, []);

  const toggleAdmin = async (cliente: Perfil) => {
    const novoAdmin = !cliente.admin;
    await updateDoc(doc(db, 'clientes', cliente.id), { admin: novoAdmin });
    setClientes(c => c.map(x => x.id === cliente.id ? { ...x, admin: novoAdmin } : x));
    mostrarToast(`${cliente.nome} ${novoAdmin ? 'promovido a admin' : 'removido de admin'}`, 'success');
  };

  const filtrados = clientes.filter(c =>
    !filtro || c.nome?.toLowerCase().includes(filtro.toLowerCase()) || c.email?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <>
      <div className="admin-topbar">
        <h1>Clientes</h1>
        <span style={{ fontSize: 14, color: 'var(--gray-400)' }}>{clientes.length} registados</span>
      </div>
      <div className="admin-content">
        <div style={{ marginBottom: 20 }}>
          <input placeholder="Pesquisar por nome ou email..." value={filtro} onChange={e => setFiltro(e.target.value)}
            style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--gray-200)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
        <div className="table-card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Admin</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5}><div className="loading"><div className="spinner" /></div></td></tr> :
                  filtrados.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.nome || '—'}</td>
                      <td>{c.email}</td>
                      <td>{c.telefone || '—'}</td>
                      <td>{c.admin ? <span style={{ color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} strokeWidth={1.5} /> Admin</span> : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => toggleAdmin(c)}>
                          {c.admin ? 'Remover admin' : 'Tornar admin'}
                        </button>
                      </td>
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
