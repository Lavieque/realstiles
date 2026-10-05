import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { permissoesDoUtilizador } from '@/lib/permissoes-server';

// Formatos permitidos a clientes (fotos das avaliações). Os admins podem
// enviar qualquer imagem ou vídeo.
const FORMATOS_CLIENTE = 'jpg,jpeg,png,webp,gif,heic,heif,avif';

export async function POST(req: Request) {
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET;
  const folder     = process.env.CLOUDINARY_FOLDER || 'realstiles';

  // Só utilizadores autenticados podem obter uma assinatura de upload
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary não configurado' }, { status: 500 });
  }

  // Equipa com permissão para gerir produtos ou conteúdo do site pode enviar
  // qualquer imagem/vídeo para a pasta principal
  const permissoes = getAdminDb() ? await permissoesDoUtilizador(uid) : new Set();
  const isEquipa = permissoes.has('produtos') || permissoes.has('conteudo');

  // Clientes: pasta própria e só imagens (allowed_formats vai assinado, o
  // Cloudinary rejeita o upload se o cliente o tentar alterar ou remover)
  const params: Record<string, string> = isEquipa
    ? { folder }
    : { folder: `${folder}/avaliacoes`, allowed_formats: FORMATOS_CLIENTE };

  const timestamp = Math.round(Date.now() / 1000);
  const toSign = Object.keys({ ...params, timestamp })
    .sort()
    .map(k => `${k}=${k === 'timestamp' ? timestamp : params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

  return NextResponse.json({ signature, timestamp, params, cloud_name: cloudName, api_key: apiKey });
}
