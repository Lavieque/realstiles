// Diagnóstico do fim inesperado de uma sessão no browser. Quando o Firebase
// deixa de ter utilizador numa página que o tinha, regista na consola (e no
// localStorage, para sobreviver ao redirect) o estado do armazenamento, para
// se perceber se foi o IndexedDB, outro separador ou o servidor.

const CHAVE_LOGOUT = 'rs_logout_ts';
const CHAVE_DIAGNOSTICO = 'rs_ultimo_fim_sessao';
const JANELA_LOGOUT_MS = 15_000;

// Chamado antes de um "Sair" pedido pelo utilizador. Usa localStorage para
// os outros separadores do site também saberem que a saída foi voluntária.
export function marcarLogoutVoluntario() {
  try { localStorage.setItem(CHAVE_LOGOUT, String(Date.now())); } catch { /* sem armazenamento */ }
}

export function logoutRecente(): boolean {
  try {
    const ts = Number(localStorage.getItem(CHAVE_LOGOUT));
    return ts > 0 && Date.now() - ts < JANELA_LOGOUT_MS;
  } catch {
    return false;
  }
}

// Só aceita caminhos internos ("/admin/x"), nunca "//dominio" ou URLs
// absolutos — o parâmetro vem do URL e não pode servir de redirect aberto.
export function caminhoInternoSeguro(valor: string | null | undefined, padrao = '/'): string {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) return padrao;
  return valor;
}

type EstadoIdb = 'com_sessao' | 'sem_sessao' | 'erro' | 'indisponivel';

// Lê a base onde o Firebase Auth guarda a sessão (firebaseLocalStorageDb).
function estadoIndexedDb(): Promise<{ estado: EstadoIdb; erro?: string }> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve({ estado: 'indisponivel' });
    const limite = setTimeout(() => resolve({ estado: 'erro', erro: 'timeout' }), 3000);
    try {
      const req = indexedDB.open('firebaseLocalStorageDb');
      // A base não existia: abortar para não a criar vazia (é do Firebase)
      let naoExistia = false;
      req.onupgradeneeded = () => { naoExistia = true; req.transaction?.abort(); };
      req.onerror = () => {
        clearTimeout(limite);
        resolve(naoExistia ? { estado: 'sem_sessao' } : { estado: 'erro', erro: String(req.error?.message ?? req.error) });
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            clearTimeout(limite); db.close(); return resolve({ estado: 'sem_sessao' });
          }
          const chaves = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAllKeys();
          chaves.onsuccess = () => {
            clearTimeout(limite); db.close();
            const temUser = chaves.result.some(k => String(k).startsWith('firebase:authUser:'));
            resolve({ estado: temUser ? 'com_sessao' : 'sem_sessao' });
          };
          chaves.onerror = () => { clearTimeout(limite); db.close(); resolve({ estado: 'erro', erro: String(chaves.error?.message ?? chaves.error) }); };
        } catch (err) {
          clearTimeout(limite); db.close();
          resolve({ estado: 'erro', erro: err instanceof Error ? err.message : String(err) });
        }
      };
    } catch (err) {
      clearTimeout(limite);
      resolve({ estado: 'erro', erro: err instanceof Error ? err.message : String(err) });
    }
  });
}

function sessaoNoLocalStorage(): boolean | null {
  try {
    return Object.keys(localStorage).some(k => k.startsWith('firebase:authUser:'));
  } catch {
    return null;
  }
}

export async function registarFimSessao(pagina: string) {
  const [idb, armazenamento] = await Promise.all([
    estadoIndexedDb(),
    navigator.storage?.estimate?.().then(e => ({ usado: e.usage, quota: e.quota })).catch(() => null) ?? Promise.resolve(null),
  ]);

  const voluntario = logoutRecente();
  const motivo = voluntario ? 'saida_voluntaria (este ou outro separador)'
    : idb.estado === 'erro' || idb.estado === 'indisponivel' ? 'indexeddb_com_erro'
    : idb.estado === 'sem_sessao' ? 'sessao_removida_do_armazenamento (limpeza de dados, outro separador ou o browser)'
    : 'token_rejeitado_ou_desconhecido';

  const diagnostico = {
    quando: new Date().toISOString(),
    pagina,
    motivo,
    indexeddb: idb,
    sessao_localstorage: sessaoNoLocalStorage(),
    armazenamento,
    online: navigator.onLine,
    visivel: document.visibilityState,
  };

  if (!voluntario) console.warn('[sessão] terminou inesperadamente', diagnostico);
  try { localStorage.setItem(CHAVE_DIAGNOSTICO, JSON.stringify(diagnostico)); } catch { /* sem armazenamento */ }
  return diagnostico;
}
