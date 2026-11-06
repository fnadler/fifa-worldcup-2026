"use client";

import { useEffect, useState } from "react";
import type { DirectoryShop } from "@/lib/shopDirectory";
import ShopCard from "./ShopCard";

// Loja oficial fixa + `count` lojas sorteadas. O HTML estático vem com as de mais itens; no navegador
// o sorteio troca, para cada visita ver lojas diferentes.

function sortear<T>(list: T[], n: number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export default function ShopHighlights({
  official,
  others,
  initial,
}: {
  official: DirectoryShop | null;
  others: DirectoryShop[];
  initial: DirectoryShop[];
}) {
  const [picked, setPicked] = useState(initial);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sorteio só no cliente, depois da hidratação
    setPicked(sortear(others, initial.length));
  }, [others, initial.length]);

  return (
    <div className="mk-shop-grid mk-shop-grid-4">
      {official && <ShopCard shop={official} />}
      {picked.map((s) => (
        <ShopCard key={s.path} shop={s} />
      ))}
    </div>
  );
}
