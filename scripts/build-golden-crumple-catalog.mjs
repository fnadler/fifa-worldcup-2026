// Gera o catálogo da Gold Crumple Edition a partir do album.json: as mesmas figurinhas do Álbum Copa
// (FWC + 48 seleções), com layout dourado — sem Coca-Cola e Legends, que não existem nessa edição.
// Códigos próprios com prefixo GC ("BRA9" → "GCBRA9", "00" → "GC00"), porque o código é único na plataforma.
//
// Saída:
//   lib/catalogs/golden-crumple.json            — blocos do catálogo
//   supabase_migration_golden_crumple.sql        — linha em albums + figurinhas em stickers
//
// Uso: node scripts/build-golden-crumple-catalog.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ALBUM_ID = "wc2026-golden-crumple";
const ALBUM_NAME = "Gold Crumple Edition";
const SLUG = "golden-crumple-2026";

const album = JSON.parse(await readFile(path.join(ROOT, "album.json"), "utf8"));
const gc = (code) => `GC${code}`;

const blocks = album.blocks
  .filter((b) => b.tipo === "FWC" || b.tipo === "TEAM")
  .map((b) => ({ id: `gc-${b.id}`, nome: b.nome, tipo: b.tipo, grupo: b.grupo, codes: b.codes.map(gc) }));
const total = blocks.reduce((n, b) => n + b.codes.length, 0);

await writeFile(path.join(ROOT, "lib", "catalogs", "golden-crumple.json"), JSON.stringify({ total, blocks }) + "\n");

const q = (s) => (s === null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const rows = blocks.flatMap((b) =>
  b.codes.map((code, i) =>
    `(${[q(code), q(ALBUM_ID), q(b.id), q(b.nome), q(b.tipo), q(b.grupo), i + 1, "null", "null",
      q(b.tipo === "TEAM" ? b.id.replace(/^gc-/, "") : null), "null", "null"].join(",")})`
  )
);

const sql = `-- Migração: coleção Gold Crumple Edition. Idempotente — gerada por scripts/build-golden-crumple-catalog.mjs.
-- Rode depois de supabase_migration_adrenalyn_limited.sql.
--
-- As mesmas figurinhas do Álbum Copa (FWC + 48 seleções, ${total} no total) com layout dourado; sem Coca-Cola
-- e Legends. Códigos com prefixo GC (GCBRA9, GC00…). Fica fora da loja até o lojista ativar.

insert into public.albums (id, name, slug, item_singular, item_plural, total_items, active, position)
values (${q(ALBUM_ID)}, ${q(ALBUM_NAME)}, ${q(SLUG)}, 'figurinha', 'figurinhas', ${total}, true, 3)
on conflict (id) do update
  set name = excluded.name, slug = excluded.slug, item_singular = excluded.item_singular,
      item_plural = excluded.item_plural, total_items = excluded.total_items, active = excluded.active;

insert into public.stickers
  (code, album_id, block_id, block_name, block_type, group_key, position, number, name, team_code, card_type, player_position)
values
${rows.join(",\n")}
on conflict (code) do update
  set album_id = excluded.album_id, block_id = excluded.block_id, block_name = excluded.block_name,
      block_type = excluded.block_type, group_key = excluded.group_key, position = excluded.position,
      number = excluded.number, name = excluded.name, team_code = excluded.team_code,
      card_type = excluded.card_type, player_position = excluded.player_position;
`;
await writeFile(path.join(ROOT, "supabase_migration_golden_crumple.sql"), sql);

console.log(`${blocks.length} blocos, ${total} figurinhas.`);
