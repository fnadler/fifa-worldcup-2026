import Image from "next/image";

// Ícone estilo app (quadrado arredondado) com a marca da Copa 2026, à esquerda do título.
export default function BrandLogo() {
  return <Image className="brand-logo" src="/brand/logo.webp" alt="" width={96} height={96} unoptimized priority />;
}
