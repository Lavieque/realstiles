import Image, { type ImageProps } from 'next/image';

// Imagens externas (Cloudinary, mas também as de produtos importados/scraped
// de sites como Temu/Shein/AliExpress) já vêm servidas por um CDN de origem —
// passá-las pelo pipeline de optimização do Vercel duplica o processamento e
// consome a quota de "Image Transformations" do plano sem benefício real,
// sobretudo com muitos produtos importados. Este wrapper desliga essa
// optimização para qualquer URL externa (http/https), mantendo-a apenas para
// assets locais em /public (logos, placeholder), que são poucos e baratos.
export default function CloudImage(props: ImageProps) {
  const src = props.src;
  const isExterna = typeof src === 'string' && /^https?:\/\//.test(src);
  return <Image {...props} unoptimized={isExterna || props.unoptimized} />;
}
