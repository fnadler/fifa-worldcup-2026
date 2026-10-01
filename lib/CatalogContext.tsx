"use client";

import { createContext, useContext } from "react";
import { DEFAULT_CATALOG, type Catalog } from "./catalog";

// Coleção sendo exibida. Sem Provider, vale o Álbum Copa (comportamento de sempre).
const CatalogContext = createContext<Catalog>(DEFAULT_CATALOG);

export const CatalogProvider = CatalogContext.Provider;

export function useCatalog(): Catalog {
  return useContext(CatalogContext);
}
