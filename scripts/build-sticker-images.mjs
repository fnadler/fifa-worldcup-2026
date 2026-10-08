// Gera as imagens otimizadas das figurinhas a partir das fotos originais em /images
// (que ficam fora do git — ~420 MB) e dos cards da Adrenalyn XL em data/adrenalyn-xl/cards
// (também fora do git; nome = número do card, ex: "024.jpeg" → AXL24). Golden Crumple Edition:
// images/golden_crumple/<CÓDIGO>.png (ex: "GCBRA9.png").
//
//   npm run images            — gera só o que ainda não existe em public/stickers
//   npm run images -- --force — refaz todas
//
// Saída (versionada):
//   public/stickers/thumb/<CODE>.webp  — 240px de largura, usada na grade da loja
//   public/stickers/large/<CODE>.webp  — 720px de largura, usada na ampliação
//   lib/sticker-images.json            — códigos que têm foto (o resto mostra o placeholder)
//
// Nomes aceitos: "178 - BRA 09.png", "002 - FWC 01.png", "CC14.png" (número de ordem opcional,
// zeros à esquerda ignorados). "FWC 00" é a figurinha de código "00" no álbum.
// Legends: "67 - LAMINE OURO.jpg" — atleta (apelido, ver LEGEND_ALIASES) + tier; o número é ignorado.

import { readdir, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIRS = ["selecoes", "fwc", "coca-cola"].map((d) => path.join(ROOT, "images", d));
const OUT = path.join(ROOT, "public", "stickers");
const SIZES = { thumb: 240, large: 720 };

const FORCE = process.argv.includes("--force");
const album = JSON.parse(await readFile(path.join(ROOT, "album.json"), "utf8"));
const adrenalyn = JSON.parse(await readFile(path.join(ROOT, "lib", "catalogs", "adrenalyn-xl.json"), "utf8"));
const golden = JSON.parse(await readFile(path.join(ROOT, "lib", "catalogs", "golden-crumple.json"), "utf8"));
const allBlocks = [...album.blocks, ...adrenalyn.blocks, ...golden.blocks];
const validCodes = new Set(allBlocks.flatMap((b) => b.codes));
const ADRENALYN_DIR = path.join(ROOT, "data", "adrenalyn-xl", "cards");
// Golden Crumple Edition: arquivo com o próprio código ("GCBRA9.png"), recortado dos PDFs da edição.
const GOLDEN_DIR = path.join(ROOT, "images", "golden_crumple");

const LEGENDS_DIR = path.join(ROOT, "images", "legends");
const LEGEND_TIERS = { REGULAR: "LIL", LILAS: "LIL", BRONZE: "BRO", PRATA: "PRA", OURO: "OUR" };
const LEGEND_ALIASES = {
  HAKIMI: "Achraf Hakimi",
  ALPHONSO: "Alphonso Davies",
  PULISIC: "Christian Pulisic",
  GAKPO: "Cody Gakpo",
  CRISTIANO: "Cristiano Ronaldo",
  HAALAND: "Erling Haaland",
  HALAAND: "Erling Haaland",
  VALVERDE: "Federico Valverde",
  WIRTZ: "Florian Wirtz",
  DOKU: "Jérémy Doku",
  BELLINGHAM: "Jude Bellingham",
  MBAPPE: "Kylian Mbappé",
  LAMINE: "Lamine Yamal",
  MESSI: "Lionel Messi",
  "LUIS DIAZ": "Luis Díaz",
  MODRIC: "Luka Modrić",
  SALAH: "Mohamed Salah",
  CAICEDO: "Moisés Caicedo",
  RAUL: "Raúl Jiménez",
  SON: "Son Heung-min",
  "VINI JUNIOR": "Vinícius Júnior",
};

function legendCodeFromFile(file) {
  const m = path.parse(file).name.match(/^(?:\d+\s*-\s*)?(.+?)\s+(\S+)$/);
  if (!m) return null;
  const prefix = LEGEND_TIERS[m[2].toUpperCase()];
  const atleta = LEGEND_ALIASES[m[1].toUpperCase()];
  const block = album.blocks.find((b) => b.id === prefix);
  const idx = block?.labels?.indexOf(atleta) ?? -1;
  return idx >= 0 ? block.codes[idx] : null;
}

function codeFromFile(file) {
  const m = path.parse(file).name.match(/^(?:\d+\s*-\s*)?([A-Za-z]+)\s*0*(\d+)$/);
  if (!m) return null;
  const code = m[1].toUpperCase() + m[2];
  return code === "FWC0" ? "00" : code;
}

const sources = new Map();
for (const dir of SRC_DIRS) {
  for (const file of await readdir(dir)) {
    if (file.startsWith(".")) continue;
    const code = codeFromFile(file);
    if (!code || !validCodes.has(code)) {
      console.warn(`ignorado (código não reconhecido): ${path.relative(ROOT, path.join(dir, file))}`);
      continue;
    }
    if (!sources.has(code)) sources.set(code, path.join(dir, file));
  }
}

for (const file of await readdir(LEGENDS_DIR)) {
  if (file.startsWith(".")) continue;
  const code = legendCodeFromFile(file);
  if (!code) {
    console.warn(`ignorado (atleta/tier não reconhecido): images/legends/${file}`);
    continue;
  }
  if (sources.has(code)) console.warn(`duplicado: images/legends/${file} → ${code}`);
  else sources.set(code, path.join(LEGENDS_DIR, file));
}

for (const file of await readdir(ADRENALYN_DIR).catch(() => [])) {
  // "024.jpeg" → AXL24; Limited Editions pelo próprio código ("AXLLE40.jpeg"). "limited-1.jpeg" etc. ficam de fora.
  const m = file.match(/^0*(\d+)\.(jpe?g|png|webp)$/i);
  const porCodigo = path.parse(file).name.toUpperCase();
  const code = m ? `AXL${m[1]}` : validCodes.has(porCodigo) ? porCodigo : null;
  if (!code || !validCodes.has(code)) continue;
  sources.set(code, path.join(ADRENALYN_DIR, file));
}

for (const file of await readdir(GOLDEN_DIR).catch(() => [])) {
  const code = path.parse(file).name.toUpperCase();
  if (validCodes.has(code) && code.startsWith("GC")) sources.set(code, path.join(GOLDEN_DIR, file));
}

await Promise.all(Object.keys(SIZES).map((s) => mkdir(path.join(OUT, s), { recursive: true })));

const exists = async (f) => (await stat(f).catch(() => null)) !== null;
const codes = [];
for (const code of sources.keys()) {
  const prontas = await Promise.all(Object.keys(SIZES).map((s) => exists(path.join(OUT, s, `${code}.webp`))));
  if (FORCE || !prontas.every(Boolean)) codes.push(code);
}
console.log(`${codes.length} para gerar (${sources.size - codes.length} já existem).`);
let done = 0;
const queue = [...codes];
async function worker() {
  while (queue.length) {
    const code = queue.shift();
    const input = sources.get(code);
    for (const [size, width] of Object.entries(SIZES)) {
      await sharp(input)
        .trim({ threshold: 12 }) // algumas fotos (ex: Coca-Cola) vêm quadradas com margem branca
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: size === "thumb" ? 72 : 80 })
        .toFile(path.join(OUT, size, `${code}.webp`));
    }
    if (++done % 100 === 0) console.log(`${done}/${codes.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

const ordered = allBlocks.flatMap((b) => b.codes).filter((c) => sources.has(c));
await writeFile(path.join(ROOT, "lib", "sticker-images.json"), JSON.stringify(ordered) + "\n");

const missing = [...validCodes].filter((c) => !sources.has(c));
console.log(`\n${ordered.length} itens com foto.`);
if (missing.length) console.log(`Sem foto (${missing.length}): ${missing.join(", ")}`);
