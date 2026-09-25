import type { Metadata } from "next";
import { politicaDePrivacidade } from "@/content/legal";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Política de privacidade — GN Coleciona" };

export default function PrivacidadePage() {
  return <LegalPage doc={politicaDePrivacidade()} />;
}
