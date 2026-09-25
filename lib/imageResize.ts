"use client";

// Recorta a imagem no centro em formato quadrado e reduz para `size` px, no navegador,
// antes do upload (a imagem da loja aparece como ícone — não precisa de mais que isso).
// WebP quando o navegador suporta codificar; senão PNG (ex: Safari antigo).
export async function squareImage(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao gerar a imagem"))), "image/webp", 0.88)
  );
}
