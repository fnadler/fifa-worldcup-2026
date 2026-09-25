import Image from "next/image";
import Link from "next/link";

// O PNG do logo tem fundo verde (não há versão transparente): recorte no contêiner,
// como no protótipo, para o fundo se fundir ao verde do topo.
export default function MarketingLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="mk-logo" aria-label="GN Coleciona — página inicial">
      <Image src="/brand/gn-coleciona-logo-300.webp" alt="GN Coleciona" width={150} height={150} priority unoptimized />
    </Link>
  );
}
