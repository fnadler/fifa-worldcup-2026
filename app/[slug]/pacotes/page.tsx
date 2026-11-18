import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import NoticeCard from "@/components/NoticeCard";
import { PLATFORM_NAME, slugProblem } from "@/lib/brand";
import { listPublicLots } from "@/lib/packsPublic";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Pacotes — ${PLATFORM_NAME}` };

// /<loja>/pacotes: com um lote só, vai direto para ele; com vários, lista.
export default async function ShopPacksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slugProblem(slug)) notFound();
  const data = await listPublicLots(slug);
  if (!data || data.lots.length === 0) notFound();
  if (data.lots.length === 1) redirect(`/${slug}/pacotes/${data.lots[0].slug}`);
  return (
    <NoticeCard kicker="Pacotes" title={data.shopName}>
      Escolha o lote:{" "}
      {data.lots.map((l, i) => (
        <span key={l.slug}>
          {i > 0 && " · "}
          <Link href={`/${slug}/pacotes/${l.slug}`}>{l.title}</Link>
        </span>
      ))}
    </NoticeCard>
  );
}
