// Gera o catálogo do Álbum Copa do Catar 2022 a partir de data/copa-catar-2022.csv (lista do checklist oficial,
// fonte: Checklist Center; 20 por seleção: foto do time, escudo e 18 jogadores). Códigos próprios com prefixo CQ
// ("BRA17" → "CQBRA17", "00" → "CQ00"), porque o código é único na plataforma e BRA17 já é da Copa 2026.
//
// Saída:
//   lib/catalogs/copa-catar-2022.json     — blocos do catálogo
//   supabase_migration_copa_catar_2022.sql — linha em albums + figurinhas em stickers
//
// Uso: node scripts/build-copa-catar-catalog.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ALBUM_ID = "wc2022-panini";
const ALBUM_NAME = "Álbum Copa do Catar 2022";
const SLUG = "copa-catar-2022";

// CSV simples: os nomes não têm vírgula nem aspas (conferido abaixo).
const [, ...lines] = (await readFile(path.join(ROOT, "data", "copa-catar-2022.csv"), "utf8")).trim().split(/\r?\n/);
const items = lines.map((l) => {
  const c = l.split(",");
  if (c.length !== 7) throw new Error(`linha inválida: ${l}`);
  return { code: `CQ${c[0]}`, bloco: c[1], nomeBloco: c[2], tipo: c[3], grupo: c[4], nome: c[5], selecao: c[6] };
});

const blocks = [];
for (const it of items) {
  let b = blocks.find((x) => x.id === `cq-${it.bloco}`);
  if (!b) {
    b = { id: `cq-${it.bloco}`, nome: it.nomeBloco, tipo: it.tipo, grupo: it.grupo, codes: [], names: [] };
    blocks.push(b);
  }
  b.codes.push(it.code);
  b.names.push(it.nome);
}
// Extras não têm número: a célula mostra o nome do atleta, como as Legends.
for (const b of blocks) {
  if (b.tipo === "LEG") {
    b.labels = b.names;
    delete b.names;
  }
}

// As Extras ficam fora do total, como as Legends no Álbum Copa 2026 (ver countsToward em lib/catalog.ts).
const total = blocks.filter((b) => b.tipo !== "LEG").reduce((n, b) => n + b.codes.length, 0);
await writeFile(path.join(ROOT, "lib", "catalogs", "copa-catar-2022.json"), JSON.stringify({ total, blocks }) + "\n");

const q = (s) => (s === null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const rows = blocks.flatMap((b) =>
  b.codes.map((code, i) =>
    `(${[q(code), q(ALBUM_ID), q(b.id), q(b.nome), q(b.tipo), q(b.grupo), i + 1, "null", q((b.labels ?? b.names)[i]),
      q(b.tipo === "TEAM" ? b.id.replace(/^cq-/, "") : null), "null", "null"].join(",")})`
  )
);

const sql = `-- Migração: coleção Álbum Copa do Catar 2022. Idempotente — gerada por scripts/build-copa-catar-catalog.mjs.
-- Rode depois de supabase_migration_golden_crumple.sql.
--
-- 00 + FWC1–29, 32 seleções com 20 figurinhas cada e Coca-Cola C1–C8: ${total} no total; mais as 80 Extra Stickers
-- (20 atletas × Bordô, Bronze, Prata, Ouro), fora do total. Códigos com prefixo CQ (CQBRA17, CQ00…).
-- Fica fora da loja até o lojista ativar.

insert into public.albums (id, name, slug, item_singular, item_plural, total_items, active, position)
values (${q(ALBUM_ID)}, ${q(ALBUM_NAME)}, ${q(SLUG)}, 'figurinha', 'figurinhas', ${total}, true, 4)
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

-- A versão Bordô se chamava Base (códigos CQEXBAS*) antes do lançamento; remove as linhas antigas, se existirem.
delete from public.stickers where code like 'CQEXBAS%';
`;
await writeFile(path.join(ROOT, "supabase_migration_copa_catar_2022.sql"), sql);

console.log(`${blocks.length} blocos, ${total} no total, ${items.length} itens.`);
