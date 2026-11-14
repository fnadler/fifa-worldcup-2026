"use client";

// Copiar para colar no WhatsApp: texto e foto.

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// A foto vai como PNG (o formato que todo navegador aceita na área de transferência). O ClipboardItem
// recebe a Promise do arquivo, para a cópia acontecer ainda dentro do clique (exigência do Safari).
async function pngFrom(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("foto");
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}

export async function copyImage(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngFrom(url) })]);
    return true;
  } catch {
    return false;
  }
}
