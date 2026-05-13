import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const REF = doc(db, 'config', 'site');

export const DEFAULTS = {
  // Página principal — hero
  hero_titulo:    'Veste o teu estilo.',
  hero_subtitulo: 'As melhores peças de vestuário, cuidadosamente seleccionadas para ti. Moda acessível e de qualidade.',
  hero_btn:       'Ver colecção',

  // Página principal — catálogo
  catalogo_titulo: 'Todos os produtos',

  // Quem Somos
  qs_hero_titulo:     'O seu pedido, a nossa responsabilidade',
  qs_sobre_titulo:    'O seu pedido, a nossa responsabilidade',
  qs_sobre_texto1:    'A Real Stiles Multi Service nasceu da vontade de simplificar o processo de compra para quem não tem tempo, acesso ou facilidade para adquirir produtos onde quer que estejam. Fazemos encomendas diversas em nome dos nossos clientes, garantindo que cada produto chega nas melhores condições.',
  qs_sobre_texto2:    'Seja um produto nacional ou internacional, você escolhe e nós compramos para você — com total compromisso desde o primeiro contacto até à entrega final.',
  qs_cta_titulo:      'Pronto para fazer o seu pedido?',
  qs_cta_subtitulo:   'Fale connosco e diga-nos o que precisa. Tratamos de tudo com rapidez e segurança.',

  // Contactos
  tel1: '878 753 754',
  tel2: '852 471 608',

  // Footer / geral
  footer_descricao: 'Encomendas diversas com segurança, transparência e agilidade.',
  copyright:        '© 2026 Real Stiles Multi Service. Todos os direitos reservados.',
  slogan:           'Excelência em Compras',
};

export async function getConfig() {
  const snap = await getDoc(REF);
  return snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
}

export async function saveConfig(dados) {
  await setDoc(REF, dados, { merge: true });
}
