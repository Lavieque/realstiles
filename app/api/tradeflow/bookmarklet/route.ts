import { NextResponse } from 'next/server';
import { exigirPermissao } from '@/lib/permissoes-server';

export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'produtos', 'integracoes');
  if (auth instanceof NextResponse) return auth;

  const tfUrl = process.env.TRADEFLOW_API_URL || '';
  const token = process.env.COOKIE_CAPTURE_TOKEN || '';
  const js = `javascript:(function(){var d=location.hostname.replace(/^www\\./,'');var c=document.cookie;if(!c){alert('Sem cookies. Navega no site primeiro.');return;}fetch('${tfUrl}/cookies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:d,cookies:c,token:'${token}'})}).then(r=>r.json()).then(()=>alert('\\u2705 Cookies guardados! Volta ao painel e importa novamente.')).catch(e=>alert('\\u274c Erro: '+e));})();`;
  return NextResponse.json({ bookmarklet: js });
}
