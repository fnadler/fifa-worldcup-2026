"use client";

// Recorta a imagem no centro em formato quadrado e reduz para `size` px, no navegador,
// antes do upload (ícone no cabeçalho e ampliada ao clicar na vitrine).
// WebP quando o navegador suporta codificar; senão PNG (ex: Safari antigo).
export async function squareImage(file: File, size = 640): Promise<Blob> {
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

// Recorta a imagem no centro na proporção width:height e reduz para esse tamanho (foto de produto, 4:5).
export async function cropImage(file: File, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = width / height;
  const sw = Math.min(bitmap.width, bitmap.height * ratio);
  const sh = sw / ratio;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao gerar a imagem"))), "image/webp", 0.88)
  );
}

// Reduz a imagem para caber em maxSide px, sem recortar (foto de lote de leilão, que vai inteira
// para o WhatsApp). JPEG: leve e aceito em qualquer lugar ao copiar e colar.
export async function fitImage(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.fillStyle = "#fff"; // PNG com transparência não fica preto no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao gerar a imagem"))), "image/jpeg", 0.88)
  );
}
