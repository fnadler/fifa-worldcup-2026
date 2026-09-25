import Image from "next/image";

// Ícone estilo app (quadrado arredondado) à esquerda do título. Sem `src`, usa o logo
// padrão da plataforma; lojas podem ter a própria imagem (Supabase Storage).
export default function BrandLogo({ src }: { src?: string | null }) {
  return (
    <Image
      className="brand-logo"
      src={src || "/brand/logo.webp"}
      alt=""
      width={96}
      height={96}
      unoptimized
      priority
    />
  );
}
