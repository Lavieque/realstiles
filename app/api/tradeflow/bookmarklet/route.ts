import { NextResponse } from 'next/server';

export async function GET() {
  const tfUrl = process.env.TRADEFLOW_API_URL || '';
  const token = process.env.COOKIE_CAPTURE_TOKEN || '';
  const js = `javascript:(function(){var d=location.hostname.replace(/^www\\./,'');var c=document.cookie;if(!c){alert('Sem cookies. Navega no site primeiro.');return;}fetch('${tfUrl}/cookies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:d,cookies:c,token:'${token}'})}).then(r=>r.json()).then(()=>alert('\\u2705 Cookies guardados! Volta ao painel e importa novamente.')).catch(e=>alert('\\u274c Erro: '+e));})();`;
  return NextResponse.json({ bookmarklet: js });
}
