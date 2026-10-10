import type { NextConfig } from "next";

// Cabeçalhos de segurança para todas as respostas.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "*.supabase.co";

// Em vigor: só o que não depende de quais scripts/estilos a página carrega.
const csp = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"].join("; ");

// Em observação (Report-Only: o navegador só avisa no console, não bloqueia). Quando não houver
// avisos nas telas principais, estas regras passam para a política em vigor acima.
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabase} wss://${supabase}`,
  csp,
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
