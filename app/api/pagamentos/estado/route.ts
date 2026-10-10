import { NextRequest, NextResponse } from 'next/server';
import { autenticar, encomendaDoCaller } from '@/lib/permissoes-server';
import { verificarPagamentosEncomenda } from '@/lib/verificar-pagamentos';

// Consulta no gateway o estado dos pagamentos de uma encomenda e confirma-a
// se estiver paga.
// - Cliente (dono da encomenda): chamado enquanto espera a confirmação no
//   telemóvel e ao voltar do checkout de cartão. Só consulta as tentativas
//   pendentes mais recentes.
// - Equipa (encomendas/pagamentos): botão "Verificar pagamento" no admin;
//   re-consulta todas as tentativas e devolve o detalhe.
export async function POST(req: NextRequest) {
  const caller = await autenticar(req);
  if (caller instanceof NextResponse) return caller;

  const { encomenda_id } = await req.json().catch(() => ({}));
  if (!encomenda_id) return NextResponse.json({ error: 'encomenda_id em falta' }, { status: 400 });

  const equipa = caller.permissoes.has('encomendas') || caller.permissoes.has('pagamentos');
  if (!equipa && !(await encomendaDoCaller(caller, String(encomenda_id)))) {
    return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 });
  }

  try {
    const r = await verificarPagamentosEncomenda(String(encomenda_id), { apenasPendentes: !equipa });
    return NextResponse.json(equipa ? r : { pago: r.pago, estado: r.estado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
