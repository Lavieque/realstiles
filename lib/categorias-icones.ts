import {
  Shirt, Footprints, Headphones, Sparkles, House, Gem, Baby, Dumbbell, Smartphone, Watch,
  ShoppingBag, Laptop, Gamepad2, Car, BookOpen, Utensils, Armchair, Lamp, Heart, Tag,
  Glasses, Backpack, Bed, Palette, Flower2, Camera, Tv, Wrench, PawPrint, Gift, Scissors,
  LayoutGrid,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Ícones de linha (sem emojis) que se podem atribuir a uma categoria no admin.
export const ICONES_CATEGORIA: Record<string, { rotulo: string; Icon: LucideIcon }> = {
  roupa:       { rotulo: 'Roupa', Icon: Shirt },
  calcado:     { rotulo: 'Calçado', Icon: Footprints },
  audio:       { rotulo: 'Áudio', Icon: Headphones },
  beleza:      { rotulo: 'Beleza', Icon: Sparkles },
  casa:        { rotulo: 'Casa', Icon: House },
  joias:       { rotulo: 'Joias', Icon: Gem },
  bebe:        { rotulo: 'Bebé', Icon: Baby },
  desporto:    { rotulo: 'Desporto', Icon: Dumbbell },
  telemovel:   { rotulo: 'Telemóvel', Icon: Smartphone },
  relogio:     { rotulo: 'Relógio', Icon: Watch },
  malas:       { rotulo: 'Malas', Icon: ShoppingBag },
  computador:  { rotulo: 'Computador', Icon: Laptop },
  jogos:       { rotulo: 'Jogos', Icon: Gamepad2 },
  auto:        { rotulo: 'Automóvel', Icon: Car },
  livros:      { rotulo: 'Livros', Icon: BookOpen },
  cozinha:     { rotulo: 'Cozinha', Icon: Utensils },
  mobiliario:  { rotulo: 'Mobiliário', Icon: Armchair },
  iluminacao:  { rotulo: 'Iluminação', Icon: Lamp },
  favoritos:   { rotulo: 'Favoritos', Icon: Heart },
  promocao:    { rotulo: 'Promoção', Icon: Tag },
  oculos:      { rotulo: 'Óculos', Icon: Glasses },
  mochila:     { rotulo: 'Mochila', Icon: Backpack },
  cama:        { rotulo: 'Cama e banho', Icon: Bed },
  arte:        { rotulo: 'Arte', Icon: Palette },
  jardim:      { rotulo: 'Jardim', Icon: Flower2 },
  foto:        { rotulo: 'Fotografia', Icon: Camera },
  tv:          { rotulo: 'TV e vídeo', Icon: Tv },
  ferramentas: { rotulo: 'Ferramentas', Icon: Wrench },
  animais:     { rotulo: 'Animais', Icon: PawPrint },
  presentes:   { rotulo: 'Presentes', Icon: Gift },
  cabelo:      { rotulo: 'Cabelo', Icon: Scissors },
  geral:       { rotulo: 'Geral', Icon: LayoutGrid },
};

// Palavras do nome da categoria -> ícone, para quando nenhum foi escolhido
const PALAVRAS: [RegExp, string][] = [
  [/sapat|calcad|tenis|sandal|chinel|bota/, 'calcado'],
  [/audio|auscult|som|coluna|headphone/, 'audio'],
  [/telem|telef|smartphone|iphone|capa/, 'telemovel'],
  [/relog/, 'relogio'],
  [/mala|carteira|bolsa/, 'malas'],
  [/mochila/, 'mochila'],
  [/oculos/, 'oculos'],
  [/joia|acessor|bijut|colar|anel/, 'joias'],
  [/beleza|cosmet|maquilh|perfume|pele/, 'beleza'],
  [/cabelo|barb/, 'cabelo'],
  [/bebe|crianca|menin|infantil|brinqued/, 'bebe'],
  [/despor|fitness|gin[aá]s|equipamento/, 'desporto'],
  [/comput|laptop|tablet|inform/, 'computador'],
  [/jogo|gaming|consola/, 'jogos'],
  [/auto|carro|moto/, 'auto'],
  [/livro|papelar|escola/, 'livros'],
  [/cozinh/, 'cozinha'],
  [/cama|banho|toalha|lencol/, 'cama'],
  [/mobil|sofa|cadeira|mesa/, 'mobiliario'],
  [/ilumin|lamp|luz/, 'iluminacao'],
  [/jardim|planta/, 'jardim'],
  [/foto|camara|camera/, 'foto'],
  [/\btv\b|televis|video/, 'tv'],
  [/ferrament|bricolage/, 'ferramentas'],
  [/animal|pet|cao|gato/, 'animais'],
  [/presente|oferta/, 'presentes'],
  [/\b(lar|casa)\b|decor|organiza/, 'casa'],
  [/roupa|moda|mulher|homem|vestid|camis|calca|casaco|saia|t-shirt|tshirt|camisola|hoodie|lingerie|fato/, 'roupa'],
  [/promo|desconto/, 'promocao'],
];

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Ícone escolhido no admin; senão adivinha pelo nome; senão um genérico
export function iconeDaCategoria(no: { icone?: string; nome: string; slug: string }): LucideIcon {
  if (no.icone && ICONES_CATEGORIA[no.icone]) return ICONES_CATEGORIA[no.icone].Icon;
  const texto = normalizar(`${no.nome} ${no.slug}`);
  const achado = PALAVRAS.find(([re]) => re.test(texto));
  return ICONES_CATEGORIA[achado ? achado[1] : 'geral'].Icon;
}
