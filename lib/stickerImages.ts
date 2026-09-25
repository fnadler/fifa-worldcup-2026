import codes from "./sticker-images.json";

// Gerado por `npm run images` — só os códigos que têm foto em public/stickers.
const WITH_IMAGE = new Set<string>(codes);

export function stickerImage(code: string, size: "thumb" | "large"): string | null {
  return WITH_IMAGE.has(code) ? `/stickers/${size}/${code}.webp` : null;
}
