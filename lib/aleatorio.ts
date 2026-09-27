// Sem dependências do Firebase — usado tanto no servidor (SSR) como no cliente.

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Ponto de partida aleatório no espaço de IDs do Firestore (os IDs automáticos
// são aleatórios, por isso ordenar por ID a partir daqui dá uma amostra aleatória).
export function gerarSeedAleatoria(): string {
  let s = '';
  for (let i = 0; i < 20; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

// Baralha de forma determinística a partir de uma seed (mesma seed = mesma ordem),
// para a ordem não mudar ao voltar de um produto.
export function baralhar<T>(lista: T[], seed: string): T[] {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...lista];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
