// Gera lib/catalogs/adrenalyn-xl.json (blocos do catálogo da Adrenalyn XL) a partir de data/adrenalyn-xl.csv
// (os 630 cards numerados) e data/adrenalyn-xl-limited.csv (Limited Editions, sem número: um bloco por
// categoria, com o nome do jogador na célula, fora do total de 630 — como as Legends no Álbum Copa).
// Uso: node scripts/build-adrenalyn-catalog.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
async function readCsv(file) {
  const csv = await readFile(path.join(ROOT, file), "utf8");
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}
const rows = await readCsv("data/adrenalyn-xl.csv");

// Seções do checklist → blocos do quadro. Seleções viram um bloco por país.
const SECTION_IDS = {
  "Golden Ballers": "golden-ballers",
  Contenders: "contenders",
  "Top Keepers": "top-keepers",
  "Defensive Rocks": "defensive-rocks",
  "Midfield Maestros": "midfield-maestros",
  "Goal Machines": "goal-machines",
  "Master Rookies": "master-rookies",
  Especiais: "especiais",
};

const blocks = [];
for (const r of rows) {
  const team = r.secao === "Seleções";
  const id = team ? `axl-${r.selecao_codigo}` : `axl-${SECTION_IDS[r.secao]}`;
  let b = blocks[blocks.length - 1];
  if (!b || b.id !== id) {
    b = {
      id,
      nome: team ? r.selecao : r.secao,
      tipo: team ? "TEAM" : r.secao === "Contenders" ? "CONTENDER" : "SPECIAL",
      grupo: team ? r.selecao_codigo : SECTION_IDS[r.secao],
      codes: [],
      names: [],
      positions: [],
      kinds: [],
    };
    blocks.push(b);
  }
  b.codes.push(`AXL${r.numero}`);
  b.names.push(r.nome);
  b.positions.push(r.posicao || null);
  b.kinds.push(r.tipo);
}

const total = blocks.reduce((s, b) => s + b.codes.length, 0);

for (const r of await readCsv("data/adrenalyn-xl-limited.csv")) {
  const id = `axl-${r.tipo.toLowerCase().replace(/_/g, "-")}`;
  let b = blocks[blocks.length - 1];
  if (b.id !== id) {
    b = { id, nome: r.categoria, tipo: "LIMITED", grupo: r.tipo, codes: [], labels: [], kinds: [] };
    blocks.push(b);
  }
  b.codes.push(r.codigo);
  b.labels.push(r.nome);
  b.kinds.push(r.tipo);
}
await writeFile(path.join(ROOT, "lib/catalogs/adrenalyn-xl.json"), JSON.stringify({ total, blocks }) + "\n");
const limited = blocks.filter((b) => b.tipo === "LIMITED").reduce((s, b) => s + b.codes.length, 0);
console.log(`${blocks.length} blocos, ${total} cards + ${limited} Limited Editions`);
