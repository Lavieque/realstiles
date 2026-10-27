export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getConfigSSR } from '@/lib/config-site-ssr';
import PoliticaLayout from '@/components/PoliticaLayout';

export const metadata: Metadata = {
  title: 'Termos e Condições — Real Stiles',
};

const SECCOES_DEFEITO = [
  { t: '1. Aceitação dos Termos', c: 'Ao aceder e utilizar este site, aceita ficar vinculado a estes Termos e Condições. Se não concordar com alguma parte, não deve utilizar o site.' },
  { t: '2. Conta de Cliente', c: 'É responsável por manter a confidencialidade da sua conta e password, e por todas as actividades realizadas através dela. Deve fornecer informações verdadeiras e actualizadas no registo.' },
  { t: '3. Encomendas e Pagamentos', c: 'Ao efectuar uma encomenda, está a fazer uma proposta de compra sujeita a confirmação e disponibilidade. Os preços e a disponibilidade dos produtos podem ser alterados sem aviso prévio.' },
  { t: '4. Propriedade Intelectual', c: 'Todo o conteúdo deste site — textos, imagens, logótipos e design — é propriedade da Real Stiles Multi Service ou dos seus fornecedores, e não pode ser copiado ou reutilizado sem autorização.' },
  { t: '5. Limitação de Responsabilidade', c: 'A Real Stiles Multi Service não se responsabiliza por atrasos ou falhas resultantes de circunstâncias fora do seu controlo razoável, incluindo transportadoras terceiras.' },
  { t: '6. Alterações aos Termos', c: 'Podemos actualizar estes Termos e Condições periodicamente. A utilização continuada do site após alterações implica a aceitação dos novos termos.' },
];

export default async function TermosPage() {
  const config = await getConfigSSR();
  const paragrafos = config.termos_conteudo.split('\n\n').map(p => p.trim()).filter(Boolean);

  return (
    <PoliticaLayout
      activo="termos"
      titulo={config.termos_titulo}
      data={config.termos_data}
      paragrafos={paragrafos}
      seccoes={SECCOES_DEFEITO}
    />
  );
}
