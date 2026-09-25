import type { Metadata } from "next";
import { COMPANY } from "@/content/legal";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Contato — GN Coleciona" };

export default function ContatoPage() {
  return (
    <LegalPage
      doc={{
        title: "Contato",
        intro: [
          "Fale com a gente para dúvidas sobre a plataforma, sua assinatura, pedidos de reembolso ou para exercer seus direitos sobre dados pessoais (LGPD).",
        ],
        sections: [
          { h: "E-mail", p: [COMPANY.email, "Respondemos em até 2 dias úteis (pedidos sobre dados pessoais: em até 15 dias, conforme a LGPD)."] },
          {
            h: "Assinatura",
            p: ["Para cancelar ou trocar o cartão, você não precisa falar com a gente: acesse Meu perfil → Assinatura da loja → Gerenciar assinatura."],
          },
          {
            h: "Compras de figurinhas",
            p: [
              "Pedidos, pagamentos e entregas de figurinhas são combinados diretamente com o vendedor pelo WhatsApp. Se tiver um problema com uma compra, fale primeiro com o vendedor; se suspeitar de fraude, nos avise pelo e-mail acima.",
            ],
          },
          { h: "Empresa", p: [`${COMPANY.razaoSocial} · CNPJ ${COMPANY.cnpj}`, COMPANY.endereco] },
        ],
      }}
    />
  );
}
