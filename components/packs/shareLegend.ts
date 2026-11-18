"use client";

import { legendName, legendTierOf } from "@/lib/packs";
import { stickerImage } from "@/lib/stickerImages";

// Imagem para compartilhar a Legend que saiu (1080×1350, formato de post/story), montada no navegador
// com as fotos do próprio site, e o compartilhamento do celular (ou download, no computador).

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fonte dos títulos (Nunito, carregada pela página) — com reserva caso não esteja disponível. */
function displayFont(): string {
  const el = document.querySelector(".lotp") ?? document.documentElement;
  const fam = getComputedStyle(el).getPropertyValue("--font-nunito").trim();
  return fam ? `${fam}, Arial, sans-serif` : "Arial, sans-serif";
}

function fitText(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxWidth: number): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 30) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export async function legendShareImage(opts: { legend: string; shopName: string; lotUrl: string }): Promise<Blob> {
  const family = displayFont();
  try {
    await Promise.all([document.fonts.load(`900 80px ${family}`), document.fonts.load(`800 40px ${family}`)]);
  } catch {
    // segue com a fonte de reserva
  }
  const photo = await loadImage(stickerImage(opts.legend, "large") ?? "");
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  // fundo verde da GN, com os círculos da landing
  ctx.fillStyle = "#029836";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 110;
  ctx.beginPath();
  ctx.arc(W + 40, -60, 380, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.beginPath();
  ctx.arc(-80, H + 40, 360, 0, Math.PI * 2);
  ctx.fill();
  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 520);
  glow.addColorStop(0, "rgba(253,202,4,0.35)");
  glow.addColorStop(1, "rgba(253,202,4,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fdca04";
  ctx.font = `900 40px ${family}`;
  ctx.fillText("PACOTE LEGENDS", W / 2, 110);
  ctx.fillStyle = "#e6f6ec";
  fitText(ctx, opts.shopName, "800", 34, family, W - 160);
  ctx.fillText(opts.shopName, W / 2, 160);

  // a figurinha, com borda branca e sombra
  const pw = 520;
  const ph = Math.round(pw * (photo.naturalHeight / photo.naturalWidth));
  const px = (W - pw) / 2;
  const py = 220;
  ctx.save();
  ctx.shadowColor = "rgba(0,30,12,0.45)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, px - 14, py - 14, pw + 28, ph + 28, 28);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.clip();
  ctx.drawImage(photo, px, py, pw, ph);
  ctx.restore();

  const name = legendName(opts.legend);
  const tier = legendTierOf(opts.legend)?.name ?? "";
  let y = py + ph + 110;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 54px ${family}`;
  ctx.fillText("Tirei", W / 2, y);
  y += 96;
  ctx.fillStyle = "#fdca04";
  fitText(ctx, name, "900", 92, family, W - 120);
  ctx.fillText(name, W / 2, y);
  y += 64;
  ctx.fillStyle = "#e6f6ec";
  ctx.font = `800 42px ${family}`;
  ctx.fillText(`Legend ${tier}`, W / 2, y);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const link = opts.lotUrl.replace(/^https?:\/\/(www\.)?/, "");
  fitText(ctx, link, "800", 30, family, W - 120);
  ctx.fillText(link, W / 2, H - 60);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("imagem"))), "image/png"));
}

/** Compartilha (celular) ou baixa (computador) a imagem. Devolve o que aconteceu, para a mensagem na tela. */
export async function shareLegend(opts: { legend: string; shopName: string; lotUrl: string }): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await legendShareImage(opts);
  const file = new File([blob], `minha-legend-${legendName(opts.legend).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`, { type: "image/png" });
  const text = `Tirei ${legendName(opts.legend)} no Pacote Legends! Escolha o seu: ${opts.lotUrl}`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
