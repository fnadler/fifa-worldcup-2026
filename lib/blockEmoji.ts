import type { AlbumBlock } from "./types";
import type { Catalog } from "./catalog";

// Emoji de cada bloco nas listas em texto (repetidas/faltantes): bandeira da seleção ou símbolo da categoria.

const FLAGS: Record<string, string> = {
  ALG: "🇩🇿", ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹", BEL: "🇧🇪", BIH: "🇧🇦", BRA: "🇧🇷", CAN: "🇨🇦", CIV: "🇨🇮", COD: "🇨🇩",
  COL: "🇨🇴", CPV: "🇨🇻", CRO: "🇭🇷", CUW: "🇨🇼", CZE: "🇨🇿", ECU: "🇪🇨", EGY: "🇪🇬", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ESP: "🇪🇸", FRA: "🇫🇷",
  GER: "🇩🇪", GHA: "🇬🇭", HAI: "🇭🇹", IRN: "🇮🇷", IRQ: "🇮🇶", JOR: "🇯🇴", JPN: "🇯🇵", KOR: "🇰🇷", KSA: "🇸🇦", MAR: "🇲🇦",
  MEX: "🇲🇽", NED: "🇳🇱", NOR: "🇳🇴", NZL: "🇳🇿", PAN: "🇵🇦", PAR: "🇵🇾", POR: "🇵🇹", QAT: "🇶🇦", RSA: "🇿🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  SEN: "🇸🇳", SUI: "🇨🇭", SWE: "🇸🇪", TUN: "🇹🇳", TUR: "🇹🇷", URU: "🇺🇾", USA: "🇺🇸", UZB: "🇺🇿",
  // seleções que só aparecem na Adrenalyn XL
  DEN: "🇩🇰", ITA: "🇮🇹", JAM: "🇯🇲", POL: "🇵🇱", UKR: "🇺🇦", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  // seleções que só aparecem no Álbum Copa do Catar 2022
  CMR: "🇨🇲", CRC: "🇨🇷", SRB: "🇷🇸",
  // seleções que só aparecem no Álbum Copa da Rússia 2018
  ISL: "🇮🇸", NGA: "🇳🇬", PER: "🇵🇪", RUS: "🇷🇺",
  // seleções que só aparecem no Álbum Copa do Brasil 2014
  CHI: "🇨🇱", GRE: "🇬🇷", HON: "🇭🇳",
  // seleções que só aparecem nos álbuns de 2010 e 2006 (Sérvia e Montenegro não tem bandeira em emoji)
  ANG: "🇦🇴", PRK: "🇰🇵", SVK: "🇸🇰", SVN: "🇸🇮", TOG: "🇹🇬", TRI: "🇹🇹",
  // seleções que só aparecem nos álbuns de 2002 e 1998 (Iugoslávia não tem bandeira em emoji)
  BUL: "🇧🇬", CHN: "🇨🇳", IRL: "🇮🇪", ROU: "🇷🇴",
};

const LEGENDS: Record<string, string> = { LIL: "💜", BRO: "🥉", PRA: "🥈", OUR: "🥇" };

const TYPES: Record<string, string> = {
  FWC: "🏆",
  CC: "🥤",
  LEG: "⭐",
  SPECIAL: "✨",
  CONTENDER: "🎯",
  LIMITED: "💎",
};

export function blockEmoji(catalog: Catalog, b: AlbumBlock): string {
  if (b.tipo === "TEAM") return FLAGS[catalog.menuCode(b) ?? ""] ?? "⚽";
  if (b.tipo === "LEG") return LEGENDS[b.id] ?? TYPES.LEG;
  return TYPES[b.tipo] ?? "⚽";
}
