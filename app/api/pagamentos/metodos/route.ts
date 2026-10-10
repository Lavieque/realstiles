import { NextResponse } from 'next/server';
import { getGatewayAtivo, metodosDisponiveis } from '@/lib/pagamentos';

export const dynamic = 'force-dynamic';

// Métodos de pagamento disponíveis no gateway activo, para o checkout só
// mostrar os que funcionam. Público: não expõe credenciais nem carteiras.
export async function GET() {
  try {
    const gateway = await getGatewayAtivo();
    return NextResponse.json({ gateway, metodos: metodosDisponiveis(gateway) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
