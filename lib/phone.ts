// Telefones brasileiros (WhatsApp): máscara, validação e normalização.
// Sem dependências — pode ser importado em qualquer tela (ex: login) sem puxar o catálogo.

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

// Número brasileiro sem DDI (10–11 dígitos) ganha o 55 na frente.
export function normalizeWhatsapp(s: string): string {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

// Dígitos nacionais (DDD + número), descartando o 55 de números já salvos com DDI.
function nationalDigits(s: string): string {
  const d = onlyDigits(s);
  return (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d.slice(0, 11);
}

// Máscara progressiva: "(11", "(11) 9999", "(11) 3333-4444", "(11) 99999-8888".
export function maskPhoneBR(input: string): string {
  const d = nationalDigits(input);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

// DDD válido (11–99, sem zero) + 8 dígitos (fixo) ou 9 começando com 9 (celular).
export function isValidPhoneBR(input: string): boolean {
  const d = nationalDigits(input);
  if (!/^[1-9]{2}/.test(d)) return false;
  return d.length === 10 || (d.length === 11 && d[2] === "9");
}
