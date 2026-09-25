# Handoff: Controle de Figurinhas Repetidas — Álbum Copa 2026

## Overview
App pessoal para registrar quais figurinhas do álbum da Copa 2026 o usuário tem e **quantas repetidas** de cada uma, ver o quadro completo (994 figurinhas) em uma única tela com rolagem e âncoras por grupo/seleção, filtrar por tipo (Seleções / FWC History / Coca-Cola) e por status (só repetidas / só faltantes), acompanhar totalizadores (por seleção e geral) e gerar a lista de repetidas para trocas.

O protótipo atual guarda tudo em `localStorage`. **O objetivo deste handoff é migrar a persistência para Supabase (Postgres + Auth) e publicar na Vercel**, mantendo a interface como está.

## About the Design Files
Os arquivos deste pacote são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, não código de produção para copiar direto. A tarefa é **recriar este design no ambiente do codebase de destino** (aqui: um projeto novo Next.js, já que não existe codebase) usando padrões e bibliotecas estabelecidos, e ligar a persistência ao Supabase.

`Figurinhas Copa 2026.dc.html` é um componente de um runtime proprietário de design (template + classe de lógica). Leia-o como **especificação**: a estrutura de dados, os cálculos de totais, os estados de célula e os estilos inline são todos exatos e podem ser portados para React quase 1:1. Não tente rodar esse arquivo em produção.

## Fidelity
**High-fidelity.** Cores, tipografia, espaçamentos, estados e interações são finais. Recriar fielmente.

---

## Modelo de dados (canônico)

O álbum tem **50 blocos / 994 figurinhas**:

| Bloco | Tipo | Códigos | Qtde |
|---|---|---|---|
| FIFA World Cup History | `FWC` | `00`, `FWC1`–`FWC19` | 20 |
| 48 seleções, 4 por grupo A–L | `TEAM` | `<COD>1`–`<COD>20` (ex. `BRA1`–`BRA20`) | 960 |
| Coca-Cola | `CC` | `CC1`–`CC14` | 14 |

Grupos (inferidos da ordem da planilha original do usuário — **confirmar com ele antes de considerar definitivo**):

- A: MEX México, RSA África do Sul, KOR Coreia do Sul, CZE Rep. Tcheca
- B: CAN Canadá, BIH Bósnia, QAT Catar, SUI Suíça
- C: BRA Brasil, MAR Marrocos, HAI Haiti, SCO Escócia
- D: USA Estados Unidos, PAR Paraguai, AUS Austrália, TUR Turquia
- E: GER Alemanha, CUW Curaçao, CIV Costa do Marfim, ECU Equador
- F: NED Holanda, JPN Japão, SWE Suécia, TUN Tunísia
- G: BEL Bélgica, EGY Egito, IRN Irã, NZL Nova Zelândia
- H: ESP Espanha, CPV Cabo Verde, KSA Arábia Saudita, URU Uruguai
- I: FRA França, SEN Senegal, IRQ Iraque, NOR Noruega
- J: ARG Argentina, ALG Argélia, AUT Áustria, JOR Jordânia
- K: POR Portugal, COD Congo, UZB Uzbequistão, COL Colômbia
- L: ENG Inglaterra, CRO Croácia, GHA Gana, PAN Panamá

A lista completa e pronta para consumo está em **`album.json`** (`{ total, blocks: [{ id, nome, tipo, grupo, codes[] }] }`).

### Regra central: `qty` é quantidade TOTAL em mãos

```
qty === 0  -> não tenho (falta)
qty === 1  -> tenho 1, colada no álbum
qty >= 2   -> colada + (qty - 1) repetidas
```

Derivados:
- `coladas   = count(qty >= 1)`
- `repetidas = sum(max(qty - 1, 0))`
- `faltam    = 994 - coladas`
- Idem por bloco, para o cabeçalho de cada seleção.

---

## Supabase

Rode **`supabase_schema.sql`** no SQL Editor do projeto Supabase. Ele cria:

- `public.stickers` — catálogo imutável das 994 figurinhas (já com o seed completo).
- `public.collection` — `(user_id, code, qty, updated_at)`, PK composta; RLS liberando **apenas as próprias linhas** do usuário autenticado.
- `public.collection_totals` — view com `coladas`/`repetidas` por bloco.

### Auth
Usar Supabase Auth com **magic link (OTP por e-mail)** — o app é de uso pessoal, sem senha é mais simples. Sem sessão, renderizar o quadro em modo leitura com aviso de login (ou permitir uso local e sincronizar após login — ver "Migração" abaixo).

### Escrita
Cada clique em uma figurinha é um `upsert` otimista:

```ts
await supabase.from('collection')
  .upsert({ user_id: user.id, code, qty: novoQty, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,code' });
```

- Atualizar o estado local **antes** da resposta (o grid precisa responder instantâneo) e reverter em erro, mostrando toast.
- Fazer **debounce/coalescing por código** (~300 ms): cliques repetidos na mesma figurinha viram um único upsert com o valor final.
- `qty === 0` pode deletar a linha ou gravar 0 — prefira `delete` para manter a tabela enxuta.
- Leitura inicial: um único `select code, qty from collection where user_id = ...` e montar um mapa `{ [code]: qty }`. Não fazer 994 requests.

### Migração dos dados que já existem
O usuário já tem marcações em `localStorage` (chave `copa2026-figurinhas-v1`, formato `{ v:1, atualizado, qtd: { [code]: number } }`) e possivelmente em mais de um dispositivo. Implementar:
1. Na primeira sessão autenticada, se existir `localStorage` com dados e a coleção remota estiver vazia → enviar tudo em um `upsert` em lote e marcar como migrado.
2. Uma tela/modal **Importar backup**: textarea que aceita o JSON exportado pelo protótipo (aceitar tanto `{qtd:{...}}` quanto o mapa cru) e faz upsert em lote.
3. Manter **Exportar** como texto copiável (o download de arquivo era bloqueado no ambiente do protótipo; em produção pode ser download real, mas mantenha o "copiar texto" como alternativa).

---

## Vercel

- Next.js (App Router) + TypeScript + `@supabase/supabase-js` e `@supabase/ssr`.
- Env vars na Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Nunca** expor a service_role key no cliente.
- Adicionar a URL de produção em Supabase → Authentication → URL Configuration (Site URL + Redirect URLs), senão o magic link volta para localhost.
- O quadro é grande (994 células): renderizar no client após a leitura da coleção; `export const dynamic = 'force-dynamic'` na página autenticada.
- PWA opcional (o usuário usa celular e desktop): manifest + ícone; vale muito para uso em banca de troca.

---

## Screens / Views

### 1. Quadro do álbum (tela única, rolagem) — única tela do app

**Layout**
- Fundo `#0a120e` + dois radiais decorativos: `radial-gradient(1200px 500px at 12% -10%, rgba(0,196,106,.16), transparent 60%)` e `radial-gradient(900px 400px at 95% 0%, rgba(255,207,77,.10), transparent 60%)`.
- Container central `max-width: 1340px`, `padding: 18px`.
- `padding-bottom: 64px` no wrapper.

**Header sticky** (`position: sticky; top: 0; z-index: 30`)
- `background: rgba(10,18,14,.94)`, `backdrop-filter: blur(10px)`, `border-bottom: 1px solid #1e3328`, `padding: 16px 18px 10px`, colunas em `flex-direction: column; gap: 12px`.
- **Linha 1**: kicker "CONTROLE DE REPETIDAS" (Barlow Condensed 600, 12px, `letter-spacing: .22em`, uppercase, `#ffcf4d`) + título "ÁLBUM COPA 2026" (Bebas Neue 40px, `line-height: .92`); à direita, três cartões de totais (`#10201a`, borda `#21382c`, raio 10px, `padding: 8px 14px`, `min-width: 96px`): **COLADAS** `n/994` (Bebas 26px `#7de2ab`, denominador 15px `#6b8a79`), **REPETIDAS** (`#ffcf4d`), **FALTAM** (`#ff8f6b`). Rótulos: 10px, 600, `letter-spacing: .14em`, uppercase, `#7f9c8c`.
- **Linha 2 (controles)**, `display: flex; gap: 10px; flex-wrap: wrap`:
  - Busca `input[type=search]`, `flex: 1 1 240px`, fundo `#0d1a14`, borda `#21382c`, raio 9px, `padding: 9px 12px`, 14px; foco → borda `#00c46a`. Placeholder "Buscar seleção ou código (ex: BRA9)". Filtra por nome da seleção, id do bloco **ou** código exato.
  - Três segmentados (container `#0d1a14`, borda `#21382c`, raio 9px, `padding: 3px`, `gap: 2px`). Chip: Barlow Condensed 600, 13px, `letter-spacing: .07em`, uppercase, `padding: 7px 12px`, raio 7px; ativo → `background: #00c46a; color: #04180d`; inativo → transparente, `color: #89a99a`.
    - Tipo: **Todas / Seleções / FWC / Coca-Cola**
    - Status: **Tudo / Só repetidas / Só faltantes**
    - Modo de clique: **+ Somar / − Tirar**
  - Botão **MINHAS REPETIDAS**: `background: #ffcf4d`, `color: #0a120e`, raio 9px, `padding: 10px 14px`, Barlow Condensed 700, 14px, `letter-spacing: .08em`, uppercase; hover `#ffe08f`.
  - Botões **BACKUP** e **IMPORTAR**: ghost — transparente, `color: #9fc2ae`, borda `#21382c`, raio 9px, `padding: 10px 12px`, 13px; hover `color: #e8f2ec`, borda `#3b5c4a`.
- **Linha 3 (âncoras)**: faixa horizontal rolável (`overflow-x: auto`, `gap: 6px`, `padding: 2px 0 10px`) com 50 botões: `FWC` (borda `#5a4a15`, fundo `#1a1706`, texto `#ffcf4d`), 48 chips `"<Grupo> · <COD>"` (borda `#21382c`, fundo `#0d1a14`, texto `#9fc2ae`, `title` = nome da seleção) e `COCA-COLA` (borda `#6b1f1f`, fundo `#1d0b0b`, texto `#ff9c9c`). Raio 8px, `padding: 7px 10px`, Barlow Condensed 600/700 13px, `white-space: nowrap`.
  - **Scroll da âncora**: medir a altura real do header sticky e usar `offset = headerHeight + 12`; `window.scrollTo({ top: elTop + scrollY - offset, behavior: 'smooth' })`. Cada bloco tem `scroll-margin-top: 190px`. Não usar offset fixo — o header muda de altura conforme a quebra de linha.

**Faixa de legenda** (abaixo do header, `padding: 18px 18px 0`, 12px, `#7f9c8c`, `gap: 18px`, wrap)
- Rótulo "LEGENDA" (10px, 600, `letter-spacing: .12em`).
- Três amostras 14×14px raio 4px: falta (`#12211a` + borda `1px dashed #37563f`), colada (`#00c46a`), repetida (`#ffcf4d`).
- Dica do modo ativo.
- À direita: **indicador de gravação** — bolinha 7px + texto 12px/600. Verde `#7de2ab`: `"Salvo HH:MM · N figurinhas na base"`. Erro `#ff8f6b`. No app com Supabase, trocar por "Sincronizado HH:MM" / "Salvando…" / "Offline — alterações pendentes".

**Blocos de seleção** (um por bloco, `gap: 14px`)
- Card: `background: #0e1b15`, borda `1px solid #1c2f25`, raio 14px, `overflow: hidden`, `id="bl-<blockId>"`.
- Cabeçalho: `padding: 12px 16px`, `background: linear-gradient(90deg,#132218,#0e1b15)`, borda inferior `#1c2f25`, `display: flex; gap: 12px; align-items: center; flex-wrap: wrap`:
  - Tag do grupo ("GRUPO C" / "FWC" / "EXTRA"): Barlow Condensed 700, 11px, `letter-spacing: .14em`, uppercase, raio 6px, `padding: 3px 8px`; TEAM → texto `#7f9c8c`, borda `#2a4436`; FWC/CC → texto `#ffcf4d`, borda `#5a4a15`.
  - Nome da seleção: Bebas Neue 25px.
  - Faixa de códigos (ex. "BRA1–20"): Barlow Condensed 13px, `letter-spacing: .1em`, uppercase, `#6b8a79`.
  - Spacer, depois `"18/20 coladas"` (12px 600 `#7de2ab`) e `"7 repetidas"` (12px 600 `#ffcf4d`).
  - Barra de progresso 120×6px, raio 99px, trilha `#1c2f25`, preenchimento `#00c46a` — vira `#ffcf4d` em 100%.
- Grid de células: `display: grid; gap: 8px; padding: 14px 16px 18px; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr))`.

**Célula da figurinha**
- `height: 46px` (configurável 34–72px), raio 8px, flex centralizado, `cursor: pointer`, `user-select: none`, Barlow Condensed 700, número em `round(altura * .36)`px.
- Estados: `qty 0` → fundo `#12211a`, borda `1px dashed #37563f`, texto `#5d7a6c`; `qty 1` → fundo/borda `#00c46a`, texto `#04180d`; `qty ≥ 2` → fundo/borda `#ffcf4d`, texto `#3a2a00`.
- Badge de repetidas (só em `qty ≥ 2`): `+n` no canto superior direito (`top: -6px; right: -5px`), fundo `#0a120e`, texto/borda `#ffcf4d`, raio 99px, 10px/700, `padding: 1px 5px`.
- Rótulo = número dentro do bloco (`BRA9` → "9"; a primeira do bloco FWC é "00").
- `title` = `"BRA9 — tenho 3 (2 repetidas) · clique para somar, clique direito inverte"`.
- **Interação**: clique aplica `+1` (ou `-1` no modo Tirar); clique direito faz o inverso e dá `preventDefault`. Limites `0..99`. `transition: transform .08s ease` (prever um leve `scale(.94)` no active).
- Acessibilidade a melhorar na implementação real: célula como `<button>` com `aria-label` completo e navegação por setas dentro do grid.

**Filtros**: quando Status ≠ "Tudo" (ou há busca por código), as células não correspondentes são **removidas** do grid e blocos que ficam sem células desaparecem. Se nada sobra: mensagem centralizada "Nenhuma figurinha com esses filtros." (`padding: 60px 20px`, 15px, `#6b8a79`). **Os totalizadores sempre refletem a base completa, não o filtro.**

### 2. Modal "Minhas repetidas"
Overlay `rgba(5,9,7,.78)` + `blur(4px)`, `z-index: 60`, centralizado, `padding: 20px`. Card `max-width: 620px`, `max-height: 84vh`, fundo `#0e1b15`, borda `#21382c`, raio 16px. Cabeçalho: título Bebas 27px "Minhas repetidas" + contagem (12px `#7f9c8c`) + botão amarelo **COPIAR LISTA** (vira "Copiado!") + botão × 32×32. Corpo rolável `white-space: pre-wrap`, 14px, `line-height: 1.7`, `#cfe3d7`.

Formato do texto:
```
REPETIDAS — ÁLBUM COPA 2026

África do Sul: RSA2 (x5), RSA3 (x21), RSA4 (x23)
Coreia do Sul: KOR2, KOR3 (x3)
```
(sem sufixo quando há apenas 1 repetida; só blocos com repetidas aparecem; vazio → "Nenhuma repetida registrada ainda.")

### 3. Modal Backup / Importar
Mesmo card (z-index 70). **Backup**: aviso "Este texto é a sua base completa (N figurinhas)…", textarea readonly 190px com o JSON, botão **Copiar** (`navigator.clipboard` + fallback `select()`/`execCommand`) e **Tentar baixar arquivo** (data URL). **Importar**: textarea editável com placeholder "Cole aqui o texto do backup...", botão verde **RESTAURAR BASE**; JSON inválido → alerta. Aceita `{v,atualizado,qtd:{}}` ou o mapa cru. Textarea: fundo `#0a120e`, borda `#21382c`, raio 10px, `padding: 12px`, monospace 12px, `line-height: 1.5`, `color: #cfe3d7`.

---

## State Management

| Estado | Tipo | Notas |
|---|---|---|
| `qtd` | `Record<string, number>` | fonte da verdade da coleção; ausente = 0 |
| `tipo` | `'ALL'\|'TEAM'\|'FWC'\|'CC'` | filtro de tipo |
| `stat` | `'ALL'\|'REP'\|'MISS'` | `REP` = `qty >= 2`, `MISS` = `qty === 0` |
| `modo` | `'add'\|'sub'` | efeito do clique simples (essencial no celular) |
| `busca` | `string` | nome/código, case-insensitive |
| `trocas` | `boolean` | modal de repetidas |
| `backup` | `null\|'export'\|'import'` | modal de backup |
| `importText` | `string` | textarea de importação |
| `salvoEm` | `Date \| 'erro' \| null` | indicador de gravação |

Na versão Supabase, acrescentar `session`, `syncing` e uma fila de upserts pendentes (para funcionar offline em banca de troca e sincronizar ao voltar a conexão).

## Design Tokens

**Cores**
`#0a120e` fundo · `#0e1b15` card · `#10201a` cartão de total · `#0d1a14` campo · `#12211a` célula vazia · `#132218` cabeçalho do card
Bordas: `#1c2f25`, `#1e3328`, `#21382c`, `#2a4436`, `#37563f` (dashed), `#3b5c4a` (hover), `#5a4a15` (FWC), `#6b1f1f` (CC)
Texto: `#e8f2ec` · `#cfe3d7` · `#9fc2ae` · `#89a99a` · `#7f9c8c` · `#6b8a79` · `#5d7a6c`
Acentos: `#00c46a` colada (configurável) · `#04180d` texto sobre verde · `#ffcf4d` repetida/destaque · `#ffe08f` hover · `#3a2a00` texto sobre amarelo · `#7de2ab` positivo · `#ff8f6b` faltam/erro · `#ff9c9c` CC
Overlay: `rgba(5,9,7,.78)` + `blur(4px)`; header `rgba(10,18,14,.94)` + `blur(10px)`

**Tipografia** (Google Fonts)
Bebas Neue — títulos e números grandes (40 / 27 / 26 / 25px).
Barlow Condensed 500/600/700 — rótulos, chips, botões, número da célula (uppercase, `letter-spacing` .06–.22em).
Barlow 400/500/600/700 — corpo (12/13/14px).
Monospace do sistema — textareas de backup.

**Espaçamento** 2 · 3 · 6 · 7 · 8 · 10 · 12 · 14 · 16 · 18 px — **Raios** 4 · 6 · 7 · 8 · 9 · 10 · 14 · 16 · 99px — **Transição** `transform .08s ease`

## Assets
Nenhuma imagem. Sem bandeiras/escudos (só código e nome da seleção) — se o usuário quiser bandeiras depois, sugerir SVGs licenciados em `public/flags/<COD>.svg`, nunca desenhadas à mão.

## Files
- `Figurinhas Copa 2026.dc.html` — protótipo completo (template + lógica): referência exata de estilos, cálculos e interações.
- `album.json` — catálogo das 994 figurinhas (50 blocos, tipo, grupo, códigos em ordem).
- `supabase_schema.sql` — DDL, RLS, view de totais e seed das 994 figurinhas.
- `Controle_Figurinhas_Ludopedio_pdf.pdf` — planilha original do usuário, fonte da numeração.

## Pendências para confirmar com o usuário
1. ~~As letras de grupo A–L foram **inferidas da ordem das linhas** da planilha; validar.~~ Confirmado.
2. ~~Login: magic link por e-mail é suficiente, ou quer uso sem conta (device id anônimo)?~~ Confirmado: magic link.
3. Quer, no futuro, comparar repetidas com outro colecionador (lista pública por link)? Isso muda o RLS — planejar, não implementar agora. (Decidido por ora: ignorar.)

---

## Status da implementação

Implementado: Next.js (App Router) + TypeScript, sem Tailwind (CSS em `app/globals.css` com os tokens deste documento), `@supabase/supabase-js` + `@supabase/ssr`, auth por magic link, sync otimista com debounce de 300ms e fila offline, migração automática do `localStorage` no primeiro login, e PWA (manifest + ícones gerados). Ver `components/AlbumApp.tsx` como orquestrador principal.

Nota de versão: o projeto foi gerado com **Next.js 16**, que renomeou `middleware.js` para **`proxy.js`** (mesmo mecanismo, arquivo/nome de export diferentes — ver `proxy.ts` na raiz).

### Rodando localmente

```bash
npm install
npm run dev
```

Crie um projeto em [supabase.com](https://supabase.com), rode `supabase_schema.sql` no SQL Editor dele, e preencha `.env.local` (veja `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Em **Authentication → URL Configuration** no painel do Supabase, adicione `http://localhost:3000` (dev) e o domínio de produção (depois do deploy) em Site URL / Redirect URLs — sem isso o magic link não funciona.

### Loja (venda de repetidas)

Rode também **`supabase_migration_shop.sql`** no SQL Editor (depois das outras migrações). Ela cria `shops`, `sticker_prices`, `orders` e a função `set_order_status`.

- **`/vendas`** (menu da conta → "Loja e pedidos"): link da loja, loja aberta/pausada, WhatsApp que recebe os pedidos, pedido mínimo, preços por grupo (FWC / Seleções / Coca-Cola) e individuais, e a lista de pedidos.
- **`/loja/<token>`**: catálogo público com carrinho. Só vende **repetidas** (`qty - 1`) com preço definido; o preço individual sobrepõe o do grupo.
- Não há pagamento online: o pedido é gravado como `novo` e o comprador o envia pelo WhatsApp (`wa.me`) do anunciante. Frete é combinado por lá.
- **Reserva de 5h** (`supabase_migration_order_reservations.sql`): pedido novo reserva os itens até `reserved_until`; disponível na loja = repetidas − reservas ativas. Vencido o prazo sem confirmação, o pedido vira "cancelado (expirado)" — a liberação é imediata (as contas olham o prazo) e a troca de status acontece na próxima leitura (`expire_orders`), sem cron. Criação (`place_order`), edição (`update_order_items`) e confirmação usam trava por vendedor para não vender a mesma repetida duas vezes.
- **Editar pedido** (só novos): incluir, alterar quantidade/preço unitário e excluir itens, respeitando o disponível; depois, "Enviar resumo ao comprador" manda o pedido atualizado pelo WhatsApp. Não estende a reserva.
- **Confirmar** dá baixa no estoque; **cancelar** um novo libera a reserva, e um confirmado devolve as figurinhas.
- A página pública e a criação de pedidos usam `SUPABASE_SERVICE_ROLE_KEY` no servidor (mesma env var do link público).

**Acesso à loja (por usuário).** Rode **`supabase_migration_shop_access.sql`**. Só quem tem uma linha ativa em `shop_entitlements` vê "Loja e pedidos", acessa `/vendas` e tem a loja pública no ar. Para habilitar alguém: Supabase → Table Editor → `shop_entitlements` → inserir `user_id` (de Authentication → Users), com `expires_at` opcional. Usuários não conseguem se autoconceder acesso (não há policy de escrita). Loja de quem perdeu o acesso aparece como "pausada".

**Legends.** Coleção à parte de 80 figurinhas (20 atletas × Lilás, Bronze, Prata, Ouro), códigos `LIL1–20`, `BRO1–20`, `PRA1–20`, `OUR1–20` — o número é o atleta em ordem alfabética (nomes em `album.json → labels`). Rode **`supabase_migration_legends.sql`** (sem ela, marcar Legends falha e a loja não carrega). Aparecem no quadro, na loja e em "Minhas repetidas", mas **não** entram em Coladas/Faltam do álbum (ver `countsTowardAlbum` em `lib/album.ts`).

**Fotos das figurinhas.** Os originais ficam em `/images` (fora do git, ~420 MB). `npm run images` gera WebP otimizados em `public/stickers/{thumb,large}` (~48 MB, versionados) e `lib/sticker-images.json`. Rode de novo sempre que adicionar/trocar fotos. Figurinha sem foto mostra o número como placeholder.

### Deploy na Vercel

1. Suba o repositório para o GitHub (ou outro git remoto).
2. Importe o repositório em [vercel.com/new](https://vercel.com/new).
3. Configure as mesmas duas env vars do `.env.local` nas configurações do projeto na Vercel.
4. Depois do primeiro deploy, adicione a URL de produção nas Redirect URLs do Supabase (passo acima).
