import { NextResponse } from 'next/server';
import { getConfigPagamentos, metodosDisponiveis } from '@/lib/pagamentos';

export const dynamic = 'force-dynamic';

// Métodos de pagamento disponíveis (ligados no admin e com o gateway
// escolhido configurado no servidor), para o checkout só mostrar os que funcionam.
// Público: não expõe credenciais nem carteiras.
export async function GET() {
  try {
    return NextResponse.json({ metodos: metodosDisponiveis(await getConfigPagamentos()) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
