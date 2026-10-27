import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageX, Clock, RotateCcw, Route } from 'lucide-react';
import { InfoHero, InfoSecao, InfoCartao, InfoGrelha, InfoPassos, InfoAjuda } from '@/components/InfoPagina';

export const metadata: Metadata = {
  title: 'Proteção de compras — Real Stiles',
  description: 'Informação antes de comprar. Apoio se surgir um problema com o artigo ou a entrega.',
};

export default function ProtecaoComprasPage() {
  return (
    <>
      <InfoHero
        eyebrow="Real Stiles · Comprar com confiança"
        titulo="A tua compra. "
        destaque="O nosso acompanhamento."
        sub="Informação antes de comprar. Apoio se surgir um problema com o artigo ou a entrega."
      >
        <Link href="/politicas?tab=devolucoes" className="btn-escuro">Consultar devoluções e reembolsos</Link>
      </InfoHero>

      <InfoSecao eyebrow="Se algo não correr como esperado" titulo="Estamos aqui " destaque="para ajudar." sub="Comunica a ocorrência com a referência da encomenda. Cada pedido é analisado de acordo com a compra e as condições aplicáveis.">
        <InfoGrelha colunas={3}>
          <InfoCartao icone={<PackageX size={20} strokeWidth={1.5} />} titulo="Artigo danificado ou incorreto" href="/reclamacao" acao="Pedir análise do artigo">
            Guarda a embalagem e, quando possível, fotografias do artigo e da etiqueta. Explica o que recebeste.
          </InfoCartao>
          <InfoCartao icone={<Clock size={20} strokeWidth={1.5} />} titulo="Atraso ou falta de entrega" href="/acompanhar" acao="Acompanhar o meu pedido">
            Consulta o estado do pedido e confirma o destino e a previsão com a equipa.
          </InfoCartao>
          <InfoCartao icone={<RotateCcw size={20} strokeWidth={1.5} />} titulo="Devolução ou reembolso" href="/politicas?tab=devolucoes" acao="Consultar condições">
            A equipa confirma a elegibilidade, os passos e a solução aplicável antes do envio de retorno.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoSecao eyebrow="Um caminho claro" titulo="Como pedir apoio " destaque="à tua compra">
        <InfoPassos passos={[
          { t: 'Conta-nos o que aconteceu.', c: 'Indica a referência, o produto e o motivo do pedido. Não envies PIN, palavras-passe ou códigos.' },
          { t: 'Recebe orientação da equipa.', c: 'A equipa analisa o caso e confirma os documentos, o transporte e os passos necessários.' },
          { t: 'Acompanha a solução.', c: 'Guarda a referência até à resolução. Troca, substituição ou reembolso são avaliados conforme o caso.' },
        ]} />
      </InfoSecao>

      <InfoSecao tom="sand" eyebrow="Um caminho claro" titulo="Da escolha " destaque="à entrega.">
        <InfoGrelha colunas={2}>
          <InfoCartao icone={<Route size={20} strokeWidth={1.5} />} titulo="Acompanhas cada etapa" href="/entregas" acao="Ver entregas e preços">
            Sabes o custo antes de pagar e podes seguir o estado da encomenda até à entrega.
          </InfoCartao>
          <InfoCartao icone={<RotateCcw size={20} strokeWidth={1.5} />} titulo="Apoio da equipa" href="/ajuda" acao="Falar com a equipa">
            Uma equipa próxima para esclarecer características, disponibilidade, pagamento e entrega.
          </InfoCartao>
        </InfoGrelha>
      </InfoSecao>

      <InfoAjuda />
    </>
  );
}
