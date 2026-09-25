// Gera as imagens otimizadas das figurinhas a partir das fotos originais em /images
// (que ficam fora do git — ~420 MB).
//
//   npm run images
//
// Saída (versionada):
//   public/stickers/thumb/<CODE>.webp  — 240px de largura, usada na grade da loja
//   public/stickers/large/<CODE>.webp  — 720px de largura, usada na ampliação
//   lib/sticker-images.json            — códigos que têm foto (o resto mostra o placeholder)
//
// Nomes aceitos: "178 - BRA 09.png", "002 - FWC 01.png", "CC14.png" (número de ordem opcional,
// zeros à esquerda ignorados). "FWC 00" é a figurinha de código "00" no álbum.
// Legends: "67 - LAMINE OURO.jpg" — atleta (apelido, ver LEGEND_ALIASES) + tier; o número é ignorado.

import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIRS = ["selecoes", "fwc", "coca-cola"].map((d) => path.join(ROOT, "images", d));
const OUT = path.join(ROOT, "public", "stickers");
const SIZES = { thumb: 240, large: 720 };

const album = JSON.parse(await readFile(path.join(ROOT, "album.json"), "utf8"));
const validCodes = new Set(album.blocks.flatMap((b) => b.codes));

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

await Promise.all(Object.keys(SIZES).map((s) => mkdir(path.join(OUT, s), { recursive: true })));

const codes = [...sources.keys()];
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

const ordered = album.blocks.flatMap((b) => b.codes).filter((c) => sources.has(c));
await writeFile(path.join(ROOT, "lib", "sticker-images.json"), JSON.stringify(ordered) + "\n");

const missing = [...validCodes].filter((c) => !sources.has(c));
console.log(`\n${ordered.length} figurinhas com foto.`);
if (missing.length) console.log(`Sem foto (${missing.length}): ${missing.join(", ")}`);
