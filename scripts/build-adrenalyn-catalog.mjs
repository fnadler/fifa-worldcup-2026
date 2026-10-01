// Gera lib/catalogs/adrenalyn-xl.json (blocos do catálogo da Adrenalyn XL) a partir de data/adrenalyn-xl.csv.
// Uso: node scripts/build-adrenalyn-catalog.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const csv = await readFile(path.join(ROOT, "data/adrenalyn-xl.csv"), "utf8");
const [header, ...lines] = csv.trim().split("\n");
const cols = header.split(",");
const rows = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));

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
await writeFile(path.join(ROOT, "lib/catalogs/adrenalyn-xl.json"), JSON.stringify({ total, blocks }) + "\n");
console.log(`${blocks.length} blocos, ${total} cards`);
