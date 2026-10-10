import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

// Capa de cada álbum (public/brand/albums/<slug>.webp|png|jpg). Sem arquivo, a tela usa uma figurinha
// da coleção no lugar — é o caso da Gold Crumple até a capa ser criada.
const EXTS = ["webp", "png", "jpg"];

export function albumCover(slug: string): string | null {
  for (const ext of EXTS) {
    const rel = `/brand/albums/${slug}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", rel))) return rel;
  }
  return null;
}
