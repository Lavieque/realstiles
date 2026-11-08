import type { SiteConfig } from './config-site';

// Documentos da página de políticas. O texto por defeito vive aqui; a
// administração (Conteúdo do site) pode substituí-lo por documento.
// Formato do texto da administração: parágrafos separados por linha em branco;
// uma linha a começar por "## " é um título de secção.

export type IdDocumento = 'compras' | 'devolucoes' | 'privacidade' | 'termos';

export interface Seccao {
  t?: string;
  c: string;
}

export interface Documento {
  id: IdDocumento;
  aba: string;
  titulo: string;
  seccoes: Seccao[];
}

export const ABAS_POLITICAS: { id: IdDocumento; aba: string }[] = [
  { id: 'compras', aba: 'Compras' },
  { id: 'devolucoes', aba: 'Devoluções' },
  { id: 'privacidade', aba: 'Privacidade' },
  { id: 'termos', aba: 'Termos' },
];

// Converte o texto da administração em secções
export function lerConteudo(texto: string): Seccao[] {
  return texto
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => {
      const m = b.match(/^##\s+(.+?)\n+([\s\S]*)$/);
      if (m) return { t: m[1].trim(), c: m[2].trim() };
      if (b.startsWith('## ')) return { t: b.slice(3).trim(), c: '' };
      return { c: b };
    });
}

export function documento(id: IdDocumento, config: SiteConfig): Documento {
  const personalizado = {
    compras: config.pol_conteudo,
    devolucoes: config.pol_devolucoes_conteudo,
    privacidade: config.pol_privacidade_conteudo,
    termos: config.termos_conteudo,
  }[id] || '';
  const base = DOCUMENTOS[id](config);
  const seccoes = personalizado.trim() ? lerConteudo(personalizado) : base.seccoes;
  return { ...base, seccoes };
}

const DOCUMENTOS: Record<IdDocumento, (c: SiteConfig) => Documento> = {
  compras: () => ({
    id: 'compras',
    aba: 'Compras',
    titulo: 'Política de compras',
    seccoes: [
      { t: '1. O que fazemos', c: 'A Real Stiles Multi Service facilita a aquisição de produtos nacionais e internacionais. Todos os produtos são fornecidos por encomenda. Cada pedido identifica o artigo, as variantes e as condições que dependem do fornecedor. A intermediação não representa uma afiliação oficial às plataformas onde os artigos são adquiridos.' },
      { t: '2. Antes de confirmar', c: 'Revê a descrição, a quantidade, o tamanho, a cor, o destino e a modalidade de entrega. O resumo apresenta o produto, os descontos, o transporte e qualquer encargo aplicável, em MZN. Um pedido sujeito a orçamento só avança depois de receberes e aceitares as condições completas.' },
      { t: '3. Confirmação e disponibilidade', c: 'Todos os artigos são por encomenda, sem disponibilidade imediata. A receção do pedido é diferente da sua confirmação. O processamento depende da validação do pagamento e, quando necessário, do stock do fornecedor. Se houver indisponibilidade, explicamos as opções de espera, alternativa ou cancelamento. Nenhum artigo é substituído sem a tua concordância.' },
      { t: '4. Pagamento pelos canais oficiais', c: 'Os métodos disponíveis podem incluir M-Pesa, e-Mola, mKesh e cartão. Guarda a referência e o comprovativo. A confirmação depende da verificação da operação, não apenas do envio de uma imagem. Nunca partilhes o PIN, a palavra-passe ou um código de autenticação com o apoio ao cliente.' },
      { t: '5. Aquisição e importação', c: 'O prazo final estimado é de 15 a 30 dias úteis, após a confirmação do pagamento e da encomenda. Inclui aquisição, importação, conferência e entrega ou levantamento no destino combinado. Eventuais encargos adicionais exigem informação e aceitação antes de prosseguir.' },
      { t: '6. Alterar ou cancelar', c: 'Contacta o apoio com a referência assim que precisares de alterar ou cancelar um pedido. A equipa verifica o estado de aquisição e expedição e explica as opções e os custos aplicáveis. As condições operacionais não afastam direitos obrigatórios do consumidor.' },
      { t: '7. Apoio em cada etapa', c: 'Mantemos a referência da encomenda nas comunicações de confirmação, disponibilidade, expedição e receção. Se existir um atraso relevante, informamos a nova previsão quando for possível e indicamos as opções de resolução. Reclamações e devoluções têm canais próprios de apoio.' },
    ],
  }),

  devolucoes: () => ({
    id: 'devolucoes',
    aba: 'Devoluções',
    titulo: 'Devoluções e reembolsos',
    seccoes: [
      { t: '1. Pedir uma análise', c: 'Inicia o pedido pelo apoio ao cliente e indica a referência, o artigo e o motivo. Explicamos os passos, a elegibilidade, o prazo aplicável e o destino de devolução antes de enviares o produto. Guarda a embalagem e os comprovativos sempre que possível.' },
      { t: '2. Defeito, dano ou artigo incorreto', c: 'Comunica a ocorrência e fornece os elementos disponíveis para identificar o problema. A solução é avaliada conforme a compra e os direitos aplicáveis: correção, troca, substituição ou reembolso, quando devido. Comunicar depressa ajuda, mas não restringe nenhum direito legal.' },
      { t: '3. Desistência e exceções', c: 'Cancelamentos e devoluções dependem do tipo de compra e das regras aplicáveis. Artigos personalizados, perecíveis ou sujeitos a restrições sanitárias podem ter condições próprias. As exceções são explicadas antes da compra e não afastam direitos por defeito ou não conformidade.' },
      { t: '4. Transporte de devolução', c: 'Confirmamos quem suporta o transporte de acordo com o motivo e as condições aplicáveis. O endereço e a modalidade de retorno são combinados por escrito. Não envies um artigo internacional diretamente ao fornecedor sem orientação.' },
      { t: '5. Reembolso e acompanhamento', c: 'Quando o reembolso for devido, comunicamos o valor, o método e a previsão de processamento aplicável. Mantemos uma referência de acompanhamento até à resolução. Os tempos do operador de pagamento são distinguidos do tratamento do pedido.' },
    ],
  }),

  privacidade: c => ({
    id: 'privacidade',
    aba: 'Privacidade',
    titulo: 'Política de privacidade',
    seccoes: [
      { t: '1. Quem trata os dados', c: `A Real Stiles Multi Service utiliza dados para executar encomendas e prestar apoio. Para qualquer questão de privacidade, contacta ${c.empresa_email || 'geral@realstiles.co.mz'} ou o telefone ${c.tel1}, indicando que o assunto é privacidade.` },
      { t: '2. Informação necessária', c: 'Podem ser usados nome, telefone, email, destino, detalhes da encomenda, referências de pagamento e comunicações de apoio. Recolhemos apenas a informação necessária à finalidade. Dados completos de cartão, PIN e credenciais de carteira móvel nunca são pedidos pelo apoio.' },
      { t: '3. Para que são utilizados', c: 'A informação permite confirmar o pedido, verificar o pagamento, organizar o transporte, comunicar estados e resolver ocorrências. Obrigações legais e prevenção de fraude podem exigir tratamento adicional. As comunicações comerciais têm fundamento adequado e uma forma simples de interrupção.' },
      { t: '4. Partilha para executar a encomenda', c: 'Os transportadores recebem os dados de entrega necessários, como destinatário, contacto, destino e referência. Operadores de pagamento, fornecedores, agentes aduaneiros e serviços tecnológicos recebem apenas o necessário à sua função.' },
      { t: '5. Conservação e segurança', c: 'Os dados são conservados pelo tempo necessário à compra, às obrigações aplicáveis e à resolução de pedidos. O acesso é limitado por função. Documentos de encomenda, comprovativos e registos de entrega têm armazenamento protegido e eliminação definida pela finalidade.' },
      { t: '6. Os teus pedidos de privacidade', c: 'Podes pedir informação, correção ou eliminação, quando aplicável, pelos contactos de apoio. Podemos solicitar uma confirmação proporcional da identidade. Se uma obrigação impedir a eliminação de um registo, explicamos o motivo e o tratamento permitido.' },
      { t: '7. Cookies e comunicações', c: 'O site usa cookies e armazenamento local essenciais para o carrinho e a sessão de conta, e pode medir as visitas de forma agregada. Podes aceitar ou recusar no aviso de cookies. Marketing nunca é uma condição para comprar.' },
    ],
  }),

  termos: c => ({
    id: 'termos',
    aba: 'Termos',
    titulo: 'Termos e condições',
    seccoes: [
      { t: '1. Identificação e âmbito', c: `${c.empresa_nome}${[c.empresa_morada, c.empresa_cidade].filter(Boolean).length ? `, ${[c.empresa_morada, c.empresa_cidade].filter(Boolean).join(', ')}` : ''}. Contactos: ${c.empresa_email || 'geral@realstiles.co.mz'}, ${c.tel1} e ${c.tel2}. Estes termos organizam a relação entre a utilização do site, a compra, a distribuição e o apoio, em conjunto com as políticas específicas.` },
      { t: '2. Informação sobre produtos', c: 'Consulta as características e confirma as variantes antes de encomendar. As fotografias ajudam a apresentação, mas não substituem a descrição acordada do artigo. Diferenças de ecrã ou de apresentação não excluem os direitos relativos à conformidade do produto.' },
      { t: '3. Pedido, confirmação e valor total', c: 'O envio de um pedido não equivale à sua aceitação definitiva. A confirmação indica os artigos, a disponibilidade, o pagamento, a entrega e os encargos aplicáveis. Erros manifestos são comunicados ao cliente, com opções de resolução compatíveis com os seus direitos.' },
      { t: '4. Intermediação e plataformas', c: 'Os produtos podem ser adquiridos junto de fornecedores nacionais ou internacionais. Referências a plataformas de compras descrevem a origem de aprovisionamento e não anunciam representação, parceria ou afiliação oficial.' },
      { t: '5. Utilização responsável', c: 'Usa os canais de forma lícita e fornece dados corretos para a encomenda. Não são permitidas a fraude, a utilização indevida de credenciais, o conteúdo ilícito ou a interferência com o funcionamento do serviço. Conteúdos e marcas respeitam os direitos dos seus titulares.' },
      { t: '6. Entrega, devolução e responsabilidade', c: 'As condições específicas constam das respetivas políticas. Problemas com fornecedor, importação ou transporte são acompanhados pela Real Stiles. Limitações operacionais e situações externas não afastam obrigações nem direitos que não possam ser excluídos.' },
      { t: '7. Reclamações e resolução', c: 'Contacta o apoio com a referência e os elementos do caso. O pedido recebe registo, acompanhamento e uma resposta clara. A relação considera a legislação aplicável em Moçambique e os meios de resolução disponíveis. Podes usar o livro de reclamações do site.' },
    ],
  }),
};
