import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, KeyRound, BadgeCheck, AlertTriangle } from 'lucide-react';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Centro de segurança — Real Stiles',
  description: 'Cuida dos teus dados, confirma os canais oficiais e compra com informação clara.',
};

export default function SegurancaPage() {
  return (
    <>
      <InfoHero
        eyebrow="Escolhe com tranquilidade"
        titulo="A tua segurança. "
        destaque="Em cada etapa."
        sub="Cuida dos teus dados, confirma os canais oficiais e compra com informação clara."
      >
        <Link href="/ajuda" className="btn-escuro">Consultar ajuda de segurança</Link>
      </InfoHero>

      <InfoSecao eyebrow="Informação que protege" titulo="Pequenos cuidados. " destaque="Mais confiança.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<ShieldCheck size={20} strokeWidth={1.5} />} titulo="Protege os teus dados." href="/politicas#privacidade" acao="Ver privacidade">
            Partilha apenas o necessário para a compra e a entrega. Consulta como são usados os teus dados.
          </InfoCartao>
          <InfoCartao icone={<KeyRound size={20} strokeWidth={1.5} />} titulo="Cuida do teu acesso." href="/conta" acao="Ajuda com a conta">
            Usa palavras-passe diferentes e confirma sempre o endereço do site antes de iniciar sessão.
          </InfoCartao>
          <InfoCartao icone={<BadgeCheck size={20} strokeWidth={1.5} />} titulo="Confirma antes de pagar." href="/ajuda" acao="Ajuda com pagamentos">
            Revê o valor e o beneficiário. O apoio nunca precisa do teu PIN, palavra-passe ou código de autenticação.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Reconhece os sinais" titulo="Desconfia da pressa. " destaque="Confirma com a equipa.">
        <InfoGrelha colunas={2}>
          <InfoCartao icone={<AlertTriangle size={20} strokeWidth={1.5} />} titulo="Pedidos urgentes">
            Pedidos urgentes de dinheiro, prémios inesperados e ligações desconhecidas merecem uma pausa.
          </InfoCartao>
          <InfoCartao icone={<ShieldCheck size={20} strokeWidth={1.5} />} titulo="Canais oficiais" href="/informacao-empresa" acao="Ver contactos oficiais">
            Recebes mensagens em nome da Real Stiles? Confirma o contacto nos canais oficiais antes de responder.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>
    </>
  );
}
