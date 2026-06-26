import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULTS = {
  hero_titulo:    'Veste o teu estilo.',
  hero_subtitulo: 'As melhores peças de vestuário, cuidadosamente seleccionadas para ti.',
  hero_btn:       'Ver colecção',
  catalogo_titulo: 'Todos os produtos',
  qs_sobre_titulo:    'O seu pedido, a nossa responsabilidade',
  qs_sobre_texto1:    'A Real Stiles Multi Service nasceu da vontade de simplificar o processo de compra para quem não tem tempo, acesso ou facilidade para adquirir produtos onde quer que estejam.',
  qs_sobre_texto2:    'Seja um produto nacional ou internacional, você escolhe e nós compramos para você — com total compromisso desde o primeiro contacto até à entrega final.',
  qs_cta_titulo:      'Pronto para fazer o seu pedido?',
  qs_cta_subtitulo:   'Fale connosco e diga-nos o que precisa. Tratamos de tudo com rapidez e segurança.',
  tel1: '878 753 754',
  tel2: '852 471 608',
  footer_descricao: 'Encomendas diversas com segurança, transparência e agilidade.',
  copyright:        '© 2026 Real Stiles Multi Service. Todos os direitos reservados.',
  slogan:           'Excelência em Compras',
  pol_titulo:    'Políticas da Loja',
  pol_data:      'Última actualização: Janeiro 2026',
  pol_conteudo:  '',
  rec_titulo: 'Livro de Reclamações',
  rec_intro:  'Prezamos pela sua satisfação. Se tiver alguma reclamação, utilize o formulário abaixo.',
};

export type SiteConfig = typeof DEFAULTS;

export async function getConfig(): Promise<SiteConfig> {
  const snap = await getDoc(doc(db, 'config', 'site'));
  return snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
}

export async function saveConfig(dados: Partial<SiteConfig>): Promise<void> {
  await setDoc(doc(db, 'config', 'site'), dados, { merge: true });
}
