import Image, { type ImageProps } from 'next/image';

// O Cloudinary já optimiza/redimensiona as imagens que aloja — passá-las pelo
// pipeline de optimização do Vercel duplica o processamento e consome a quota
// de "Image Transformations" do plano sem benefício. Este wrapper desliga essa
// optimização apenas para imagens do Cloudinary, mantendo-a para o resto (logos
// e outros assets locais em /public).
export default function CloudImage(props: ImageProps) {
  const src = props.src;
  const isCloudinary = typeof src === 'string' && src.includes('res.cloudinary.com');
  return <Image {...props} unoptimized={isCloudinary || props.unoptimized} />;
}
