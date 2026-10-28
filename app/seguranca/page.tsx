import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, KeyRound, BadgeCheck, Mail, Phone } from 'lucide-react';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha, InfoAjuda } from '@/components/InfoPagina';

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
        <Link href="/atendimento" className="btn-escuro">Consultar ajuda de segurança</Link>
      </InfoHero>

      <InfoSecao eyebrow="Informação que protege" titulo="Pequenos cuidados. " destaque="Mais confiança.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<ShieldCheck size={20} strokeWidth={1.5} />} titulo="Protege os teus dados." href="/politicas?tab=privacidade" acao="Ver privacidade">
            Partilha apenas o necessário para a compra e a entrega. Consulta como são usados os teus dados.
          </InfoCartao>
          <InfoCartao icone={<KeyRound size={20} strokeWidth={1.5} />} titulo="Cuida do teu acesso." href="/atendimento" acao="Ajuda com a conta">
            Usa palavras-passe diferentes e confirma sempre o endereço do site antes de iniciar sessão.
          </InfoCartao>
          <InfoCartao icone={<BadgeCheck size={20} strokeWidth={1.5} />} titulo="Confirma antes de pagar." href="/atendimento" acao="Ajuda com pagamentos">
            Revê o valor e o beneficiário. O apoio nunca precisa do teu PIN, palavra-passe ou código de autenticação.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Reconhece os sinais" titulo="Desconfia da pressa. " destaque="Confirma com a equipa." sub="Pedidos urgentes de dinheiro, prémios inesperados e ligações desconhecidas merecem uma pausa.">
        <div className="faq">
          <details>
            <summary>Recebeste um email, SMS ou mensagem suspeita?</summary>
            <p>Não abras anexos nem introduzas dados em ligações desconhecidas. Confirma a mensagem através do email ou dos números oficiais da Real Stiles.</p>
          </details>
          <details>
            <summary>Alguém pediu o teu PIN ou código de confirmação?</summary>
            <p>Não partilhes. Introduz o PIN apenas no canal oficial da tua carteira ou banco, quando iniciares e confirmares uma operação.</p>
          </details>
          <details>
            <summary>Já fizeste um pagamento suspeito?</summary>
            <p>Contacta imediatamente o teu banco ou operador de carteira móvel. Guarda as referências e comunica a situação à equipa pelos canais oficiais.</p>
          </details>
        </div>
        <div className="info-hero-acoes" style={{ marginTop: 24 }}>
          <Link href="/ajuda#mensagem" className="btn-escuro">Comunicar uma situação suspeita</Link>
        </div>
      </InfoSecao>

      <InfoSecao eyebrow="Confirma qualquer pedido" titulo="Os nossos " destaque="contactos oficiais." sub="Confirma qualquer pedido antes de partilhares dados ou efetuares um pagamento.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<Mail size={20} strokeWidth={1.5} />} titulo="Email"><a href="mailto:geral@realstiles.co.mz">geral@realstiles.co.mz</a></InfoCartao>
          <InfoCartao icone={<Phone size={20} strokeWidth={1.5} />} titulo="Telefone"><a href="tel:+258878753754">+258 878 753 754</a><br /><a href="tel:+258852471608">+258 852 471 608</a></InfoCartao>
          <InfoCartao icone={<ShieldCheck size={20} strokeWidth={1.5} />} titulo="Informação da empresa" href="/informacao-empresa" acao="Ver dados oficiais">Os dados oficiais da Real Stiles Multi Service.</InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoAjuda />
    </>
  );
}
