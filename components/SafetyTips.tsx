import { PLATFORM_NAME } from "@/lib/brand";

// Orientações mostradas no checkout, antes de confirmar o pedido. Tom de "dicas de quem já
// compra figurinhas", para ajudar sem assustar; o aviso de responsabilidade vem por último.
const DICAS = [
  {
    icone: "📸",
    titulo: "Peça fotos ou um vídeo das figurinhas",
    texto: "É rapidinho e você confere que são exatamente as do seu pedido.",
  },
  {
    icone: "✅",
    titulo: "Pague depois de conferir",
    texto: "Faça o Pix ou depósito só quando tiver certeza de que o vendedor tem as figurinhas.",
  },
  {
    icone: "📦",
    titulo: "Combine o código de rastreio",
    texto: "Se for pelo correio, peça o rastreio para acompanhar sua compra até chegar.",
  },
  {
    icone: "📍",
    titulo: "Mesma cidade? Dá para entregar em mãos",
    texto: "Combinem num lugar público e movimentado, como um shopping ou uma banca de revistas.",
  },
  {
    icone: "🔄",
    titulo: "Que tal uma troca?",
    texto: "Se o vendedor topar, vocês podem trocar repetidas — sozinho ou junto com a compra.",
  },
];

export default function SafetyTips() {
  return (
    <section className="safety-tips" aria-label="Dicas para uma compra tranquila">
      <div className="safety-tips-head">
        <strong>Dicas para uma compra tranquila 🤝</strong>
        <span>
          Você fecha o negócio direto com o colecionador pelo WhatsApp. Com estes cuidados simples, fica tudo mais
          fácil e seguro:
        </span>
      </div>
      <ul className="safety-tips-list">
        {DICAS.map((d) => (
          <li key={d.titulo}>
            <span className="safety-tips-icon" aria-hidden="true">
              {d.icone}
            </span>
            <span>
              <strong>{d.titulo}</strong>
              <span>{d.texto}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="safety-tips-note">
        A {PLATFORM_NAME} é o catálogo que conecta você ao vendedor: não intermedia pagamentos nem entregas, e não se
        responsabiliza pela venda de figurinhas entre colecionadores.
      </p>
    </section>
  );
}
