// Gera o catálogo do Álbum Copa da Itália 1990 a partir de data/copa-italia-1990.csv (numeração do gabarito,
// 1 a 448; nomes conferidos com o impresso em cada figurinha). Códigos com prefixo IT, mostrados só
// com o número, porque o código é único na plataforma.
//
// Saída:
//   lib/catalogs/copa-italia-1990.json      — blocos do catálogo
//   supabase_migration_copa_italia_1990.sql — linha em albums + figurinhas em stickers
//
// Uso: node scripts/build-copa-italia-catalog.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ALBUM_ID = "wc1990-panini";
const ALBUM_NAME = "Álbum Copa da Itália 1990";
const SLUG = "copa-italia-1990";

// CSV simples: os nomes não têm vírgula nem aspas duplas.
const [, ...lines] = (await readFile(path.join(ROOT, "data", "copa-italia-1990.csv"), "utf8")).trim().split(/\r?\n/);
const blocks = [];
for (const l of lines) {
  const c = l.split(",");
  if (c.length !== 7) throw new Error(`linha inválida: ${l}`);
  const id = `it-${c[1]}`;
  let b = blocks.find((x) => x.id === id);
  if (!b) {
    b = { id, nome: c[2], tipo: c[3], grupo: c[4], codes: [], names: [] };
    blocks.push(b);
  }
  b.codes.push(`IT${c[0]}`);
  b.names.push(c[5]);
}

const total = blocks.reduce((n, b) => n + b.codes.length, 0);
await writeFile(path.join(ROOT, "lib", "catalogs", "copa-italia-1990.json"), JSON.stringify({ total, blocks }) + "\n");

const q = (s) => (s === null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const rows = blocks.flatMap((b) =>
  b.codes.map((code, i) => {
    const numero = Number(code.replace(/^IT/, ""));
    return `(${[q(code), q(ALBUM_ID), q(b.id), q(b.nome), q(b.tipo), q(b.grupo), i + 1, Number.isNaN(numero) ? "null" : numero, q(b.names[i]),
      q(b.tipo === "TEAM" ? b.id.replace(/^it-/, "") : null), "null", "null"].join(",")})`;
  })
);

const sql = `-- Migração: coleção Álbum Copa da Itália 1990. Idempotente — gerada por scripts/build-copa-italia-catalog.mjs.
-- Rode depois de supabase_migration_copa_eua_1994.sql.
--
-- ${total} figurinhas numeradas de 1 a 448: campeões, cidades e estádios e 24 seleções (Camarões, Costa Rica, Emirados, Coreia do Sul e Egito com figurinhas duplas).
-- Códigos com prefixo IT. Fica fora da loja até o lojista ativar.

insert into public.albums (id, name, slug, item_singular, item_plural, total_items, active, position)
values (${q(ALBUM_ID)}, ${q(ALBUM_NAME)}, ${q(SLUG)}, 'figurinha', 'figurinhas', ${total}, true, 12)
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
await writeFile(path.join(ROOT, "supabase_migration_copa_italia_1990.sql"), sql);

console.log(`${blocks.length} blocos, ${total} figurinhas.`);
