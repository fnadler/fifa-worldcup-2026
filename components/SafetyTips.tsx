import { PLATFORM_NAME } from "@/lib/brand";

// Orientações mostradas no checkout, antes de confirmar o pedido. Tom de "dicas de quem já
// compra figurinhas e cards", para ajudar sem assustar; o aviso de responsabilidade vem por último.
const DICAS = [
  {
    icone: "📸",
    titulo: "Peça fotos ou um vídeo dos itens",
    texto: "É rapidinho e você confere que são exatamente os do seu pedido.",
  },
  {
    icone: "✅",
    titulo: "Pague depois de conferir",
    texto: "Faça o Pix ou depósito só quando tiver certeza de que o vendedor tem os itens.",
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

// Pacotes: o conteúdo é sorteado, então não há o que fotografar nem trocar antes de pagar.
const DICAS_PACOTES = [
  {
    icone: "💬",
    titulo: "Pague pelo WhatsApp da loja",
    texto: "O pedido vai para o WhatsApp da loja. Faça o Pix só para os dados que ela enviar nessa conversa.",
  },
  {
    icone: "🔗",
    titulo: "Guarde o link dos seus pacotes",
    texto: "Com o pagamento confirmado, você recebe por e-mail o link para abrir os pacotes e ver o que veio.",
  },
  {
    icone: "📦",
    titulo: "Combine o código de rastreio",
    texto: "Se for pelo correio, peça o rastreio para acompanhar suas figurinhas até chegar.",
  },
  {
    icone: "📍",
    titulo: "Mesma cidade? Dá para entregar em mãos",
    texto: "Combinem num lugar público e movimentado, como um shopping ou uma banca de revistas.",
  },
];

/** `pacotes`: versão do checkout dos pacotes (sem fotos nem trocas, que não cabem num conteúdo sorteado). */
export default function SafetyTips({ variant = "loja" }: { variant?: "loja" | "pacotes" }) {
  const pacotes = variant === "pacotes";
  return (
    <section className="safety-tips" aria-label="Dicas para uma compra tranquila">
      <div className="safety-tips-head">
        <strong>Dicas para uma compra tranquila 🤝</strong>
        <span>
          {pacotes
            ? "Você fecha o pedido direto com a loja pelo WhatsApp. Com estes cuidados simples, fica tudo mais fácil e seguro:"
            : "Você fecha o negócio direto com o colecionador pelo WhatsApp. Com estes cuidados simples, fica tudo mais fácil e seguro:"}
        </span>
      </div>
      <ul className="safety-tips-list">
        {(pacotes ? DICAS_PACOTES : DICAS).map((d) => (
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
        {pacotes
          ? `A ${PLATFORM_NAME} é a plataforma onde a loja monta os pacotes: não intermedia pagamentos nem entregas, e não se responsabiliza pela venda feita pela loja.`
          : `A ${PLATFORM_NAME} é o catálogo que conecta você ao vendedor: não intermedia pagamentos nem entregas, e não se responsabiliza pela venda de figurinhas e cards entre colecionadores.`}
      </p>
    </section>
  );
}
