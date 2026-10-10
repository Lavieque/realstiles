import { NextResponse } from 'next/server';
import { getConfigPagamentos, metodosDisponiveis } from '@/lib/pagamentos';

export const dynamic = 'force-dynamic';

// Métodos de pagamento disponíveis no gateway activo (configurados no
// servidor e ligados no admin), para o checkout só mostrar os que funcionam.
// Público: não expõe credenciais nem carteiras.
export async function GET() {
  try {
    const { ativo, desativados } = await getConfigPagamentos();
    return NextResponse.json({ gateway: ativo, metodos: metodosDisponiveis(ativo, desativados) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
