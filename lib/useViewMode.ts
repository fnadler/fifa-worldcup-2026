"use client";

import { useCallback, useEffect, useState } from "react";
import type { ViewMode } from "./types";

export const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "photos", label: "Fotos" },
  { value: "grid", label: "Grade" },
];

// Preferência Fotos/Grade lembrada por navegador (uma chave por tela). Começa em
// "photos" no SSR e restaura depois de montar, para não haver mismatch de hidratação.
export function useViewMode(storageKey: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>("photos");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "grid" || saved === "photos") queueMicrotask(() => setView(saved));
    } catch {
      // preferência é só conveniência
    }
  }, [storageKey]);

  const change = useCallback(
    (v: ViewMode) => {
      setView(v);
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {
        // conveniência apenas
      }
    },
    [storageKey]
  );

  return [view, change];
}
