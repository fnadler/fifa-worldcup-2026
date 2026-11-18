import { useId } from "react";

// Envelope próprio do Pacote Legends (SVG 300×400): faixas serrilhadas, campo verde, "PACOTE LEGENDS",
// selo "+1 Legend garantida" e "7 figurinhas". `seller`: nome de quem montou (rodapé do envelope).
export default function Envelope({ seller, className }: { seller: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const ridges = Array.from({ length: 60 }, (_, i) => i * 5 + 2);
  const font = { cond: "var(--font-barlow-condensed), 'Arial Narrow', sans-serif", display: "var(--font-bebas-neue), Impact, sans-serif" };
  return (
    <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#0d8a45" />
          <stop offset=".55" stopColor="#076232" />
          <stop offset="1" stopColor="#033d1d" />
        </linearGradient>
        <linearGradient id={`au${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".45" stopColor="#ffcf4d" />
          <stop offset="1" stopColor="#c8920f" />
        </linearGradient>
        <linearGradient id={`sh${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <rect x="0" y="22" width="300" height="356" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="300" height="400" fill="#eef3ef" />
      <g stroke="#cfd9d2" strokeWidth="1">
        {ridges.map((x) => (
          <line key={`t${x}`} x1={x} y1="0" x2={x} y2="22" />
        ))}
        {ridges.map((x) => (
          <line key={`b${x}`} x1={x} y1="378" x2={x} y2="400" />
        ))}
      </g>
      <rect x="0" y="0" width="10" height="22" fill="#0a2015" />
      <rect x="290" y="0" width="10" height="22" fill="#0a2015" />
      <rect x="0" y="378" width="10" height="22" fill="#0a2015" />
      <rect x="290" y="378" width="10" height="22" fill="#0a2015" />
      <rect x="0" y="22" width="300" height="356" fill={`url(#g${id})`} />
      <g clipPath={`url(#c${id})`} fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="2">
        <rect x="22" y="70" width="256" height="290" />
        <line x1="22" y1="215" x2="278" y2="215" />
        <circle cx="150" cy="215" r="44" />
        <rect x="95" y="70" width="110" height="40" />
        <rect x="95" y="320" width="110" height="40" />
      </g>
      <g clipPath={`url(#c${id})`}>
        <circle cx="150" cy="198" r="120" fill="#ffcf4d" fillOpacity=".07" />
        <rect x="-60" y="22" width="420" height="356" fill={`url(#sh${id})`} />
      </g>
      <line x1="0" y1="47" x2="300" y2="47" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="150" y="40" textAnchor="middle" fontFamily={font.cond} fontWeight="700" fontSize="10" letterSpacing="2.5" fill="#fff" fillOpacity=".8">
        ABRA AQUI ▸ ▸ ▸
      </text>
      <g transform="translate(150 88)">
        <text x="-14" y="0" textAnchor="middle" fontFamily={font.display} fontSize="34" fill="#fff">
          GN
        </text>
        <g transform="translate(14 -24)">
          <rect x="6" y="2" width="16" height="22" rx="2" fill="#ffcf4d" transform="rotate(14 14 13)" />
          <rect x="2" y="1" width="16" height="22" rx="2" fill="#7de2ab" transform="rotate(6 10 12)" />
          <rect x="-2" y="0" width="16" height="22" rx="2" fill="#fff" />
          <circle cx="6" cy="8" r="2.4" fill="#0a5a2c" />
          <path d="M6 10.5 L6 16 M3 13 L9 13 M6 16 L3.5 20 M6 16 L8.5 20" stroke="#0a5a2c" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <text x="0" y="16" textAnchor="middle" fontFamily={font.cond} fontWeight="700" fontSize="11" letterSpacing="3" fill="#fff">
          COLECIONA
        </text>
      </g>
      <text x="150" y="152" textAnchor="middle" fontFamily={font.cond} fontWeight="700" fontSize="15" letterSpacing="6" fill="#e9f1ec">
        PACOTE
      </text>
      <text
        x="150"
        y="214"
        textAnchor="middle"
        fontFamily={font.display}
        fontSize="74"
        letterSpacing="1"
        fill={`url(#au${id})`}
        stroke="#5a3d00"
        strokeOpacity=".35"
        strokeWidth="1"
      >
        LEGENDS
      </text>
      <g transform="translate(150 246)">
        <circle cx="-27" cy="0" r="6" fill="#b88cff" />
        <circle cx="-9" cy="0" r="6" fill="#d08a4f" />
        <circle cx="9" cy="0" r="6" fill="#d4dbe2" />
        <circle cx="27" cy="0" r="6" fill="#ffcf4d" />
      </g>
      <g transform="translate(232 300) rotate(-12)">
        <circle r="34" fill={`url(#au${id})`} stroke="#fff3c4" strokeWidth="2" />
        <circle r="28" fill="none" stroke="#5a3d00" strokeOpacity=".35" strokeDasharray="2 3" />
        <text y="-6" textAnchor="middle" fontFamily={font.display} fontSize="17" fill="#3a2a00">
          +1 LEGEND
        </text>
        <text y="10" textAnchor="middle" fontFamily={font.cond} fontWeight="700" fontSize="9.5" letterSpacing="1" fill="#3a2a00">
          GARANTIDA
        </text>
      </g>
      <g transform="translate(26 326)">
        <rect width="78" height="38" rx="6" fill="#fff" />
        <text x="10" y="27" fontFamily={font.display} fontSize="28" fill="#076232">
          7
        </text>
        <text x="27" y="17" fontFamily={font.cond} fontWeight="700" fontSize="9.5" letterSpacing=".5" fill="#076232">
          FIGURI-
        </text>
        <text x="27" y="28" fontFamily={font.cond} fontWeight="700" fontSize="9.5" letterSpacing=".5" fill="#076232">
          NHAS
        </text>
      </g>
      <text x="150" y="372" textAnchor="middle" fontFamily={font.cond} fontWeight="700" fontSize="9" letterSpacing="2" fill="#fff" fillOpacity=".55">
        {`COPA 2026 · MONTADO POR ${seller.toUpperCase()}`.slice(0, 48)}
      </text>
    </svg>
  );
}
