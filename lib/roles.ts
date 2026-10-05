import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { CHAVES_PERMISSAO, filtrarPermissoes } from './permissoes';
import type { Permissao } from './permissoes';
import type { Perfil } from './auth';

export interface Role {
  id: string;
  nome: string;
  descricao: string;
  permissoes: Permissao[];
  criado_em?: unknown;
}

const COL = 'roles';

function paraRole(id: string, dados: Record<string, unknown>): Role {
  return {
    id,
    nome: String(dados.nome ?? ''),
    descricao: String(dados.descricao ?? ''),
    permissoes: filtrarPermissoes(dados.permissoes),
    criado_em: dados.criado_em,
  };
}

export async function getRoles(): Promise<Role[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs
    .map(d => paraRole(d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function getRole(id: string): Promise<Role | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? paraRole(snap.id, snap.data()) : null;
}

export async function criarRole(dados: Pick<Role, 'nome' | 'descricao' | 'permissoes'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...dados, criado_em: serverTimestamp() });
  return ref.id;
}

export async function actualizarRole(id: string, dados: Pick<Role, 'nome' | 'descricao' | 'permissoes'>): Promise<void> {
  await updateDoc(doc(db, COL, id), dados);
}

export async function apagarRole(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function atribuirRole(clienteId: string, roleId: string | null): Promise<void> {
  await updateDoc(doc(db, 'clientes', clienteId), { role: roleId });
}

export async function definirSuperAdmin(clienteId: string, admin: boolean): Promise<void> {
  await updateDoc(doc(db, 'clientes', clienteId), { admin });
}

// Super admin (admin: true) tem sempre todas as permissões; os restantes
// herdam as da role atribuída.
export async function getPermissoesPerfil(perfil: Perfil | null): Promise<{ permissoes: Set<Permissao>; role: Role | null }> {
  if (!perfil) return { permissoes: new Set(), role: null };
  if (perfil.admin) return { permissoes: new Set(CHAVES_PERMISSAO), role: null };
  if (!perfil.role) return { permissoes: new Set(), role: null };
  const role = await getRole(perfil.role).catch(() => null);
  return { permissoes: new Set(role?.permissoes ?? []), role };
}
