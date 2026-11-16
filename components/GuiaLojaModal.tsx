"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useCatalog } from "@/lib/CatalogContext";

// Guia da loja: abre sobre o quadro para quem veio vender as repetidas (?guia=loja, depois da escolha das
// coleções), antes de começar a marcar o estoque. Passo a passo, com "Ver todos os passos" numa lista só e
// "Pular" a qualquer momento — quem já sabe vai direto para o quadro.

interface Passo {
  titulo: string;
  texto: ReactNode;
}

function passos(item: string, itemPlural: string, fem: boolean, trialDays: number): Passo[] {
  const a = fem ? "a" : "o";
  return [
    {
      titulo: `Marque ${fem ? "as" : "os"} ${itemPlural} que você tem`,
      texto: (
        <>
          Toque em cada {item} para somar 1 unidade. A 1ª unidade fica na sua coleção; <strong>a partir da 2ª, é repetida</strong> e
          entra no estoque da loja. Exemplo: tocou 3 vezes n{a} mesm{a} {item} = 1 na coleção + 2 repetidas à venda. Errou? No
          computador, clique com o botão direito; no celular, use o “−” no modo Fotos.
        </>
      ),
    },
    {
      titulo: "Muitas de uma vez: marcação em lote",
      texto: (
        <>
          No botão <strong>Marcar em lote</strong>, no topo (ou no ícone de cada bloco), escolha seleções ou blocos inteiros e a quantidade.
          “Definir” deixa todos com o mesmo número; “Somar” acrescenta ao que já tem. Você vê a prévia antes de aplicar e pode desfazer
          logo depois.
        </>
      ),
    },
    {
      titulo: `Ative a loja: ${trialDays} dias grátis`,
      texto: (
        <>
          Com o estoque marcado, toque em <strong>Minha loja</strong>. Você confirma o seu e-mail com um código e cadastra o cartão: a
          cobrança só acontece depois dos {trialDays} dias, e dá para cancelar quando quiser, sem multa.
        </>
      ),
    },
    {
      titulo: "Configure a loja",
      texto: (
        <>
          Em <strong>Configurações</strong>: o nome da loja (ele vira o seu endereço, gncoleciona.com.br/nome-da-loja), o WhatsApp que
          recebe os pedidos, a imagem da loja e, se quiser, um pedido mínimo.
        </>
      ),
    },
    {
      titulo: "Defina os preços",
      texto: (
        <>
          Em <strong>Preços</strong>: um preço por grupo (o mesmo para todas as {itemPlural} do grupo) e, se quiser, preço individual para
          as mais valiosas. Só aparece na loja repetida que tem preço.
        </>
      ),
    },
    {
      titulo: "Produtos especiais (opcional)",
      texto: (
        <>
          Em <strong>Produtos</strong>: kits, envelopes, álbuns ou o que mais você quiser vender, com foto e preço.
        </>
      ),
    },
    {
      titulo: "Abra a loja e divulgue",
      texto: (
        <>
          Com nome, WhatsApp e pelo menos 1 repetida com preço, é só <strong>abrir a loja</strong> e compartilhar o link. Os pedidos chegam no
          seu WhatsApp e no painel, e o estoque baixa sozinho quando você confirma a venda.
        </>
      ),
    },
  ];
}

export default function GuiaLojaModal({ trialDays, onClose }: { trialDays: number; onClose: () => void }) {
  const catalog = useCatalog();
  const lista = passos(catalog.itemSingular, catalog.itemPlural, catalog.itemSingular === "figurinha", trialDays);
  const [i, setI] = useState(0);
  const [tudo, setTudo] = useState(false);
  const ultimo = i === lista.length - 1;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="modal-overlay guia-overlay" role="dialog" aria-modal="true" aria-label="Como montar sua loja" onClick={onClose}>
      <div className="modal-card guia-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Como montar sua loja</span>
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {tudo ? (
          <ol className="guia-lista">
            {lista.map((p, n) => (
              <li key={p.titulo}>
                <span className="guia-num">{n + 1}</span>
                <div>
                  <strong>{p.titulo}</strong>
                  <p>{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="guia-passo" aria-live="polite">
            <span className="guia-contador">
              Passo {i + 1} de {lista.length}
            </span>
            <h3>
              <span className="guia-num">{i + 1}</span>
              {lista[i].titulo}
            </h3>
            <p>{lista[i].texto}</p>
            <div className="guia-pontos" aria-hidden="true">
              {lista.map((p, n) => (
                <span key={p.titulo} className={n === i ? "on" : ""} />
              ))}
            </div>
          </div>
        )}

        <div className="guia-acoes">
          <button type="button" className="link-button" onClick={tudo ? () => setTudo(false) : () => setTudo(true)}>
            {tudo ? "Ver passo a passo" : "Ver todos os passos"}
          </button>
          <div className="guia-acoes-dir">
            {!tudo && !ultimo && (
              <button type="button" className="btn-ghost" onClick={onClose}>
                Pular
              </button>
            )}
            {!tudo && i > 0 && (
              <button type="button" className="btn-ghost" onClick={() => setI(i - 1)}>
                Voltar
              </button>
            )}
            <button type="button" className="btn-primary" onClick={tudo || ultimo ? onClose : () => setI(i + 1)}>
              {tudo || ultimo ? "Começar a marcar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
