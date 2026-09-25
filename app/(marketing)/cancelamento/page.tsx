import type { Metadata } from "next";
import { politicaDeCancelamento } from "@/content/legal";
import { GRACE_DAYS, TRIAL_DAYS } from "@/lib/stripe";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Cancelamento e reembolso — GN Coleciona" };

export default function CancelamentoPage() {
  return <LegalPage doc={politicaDeCancelamento(TRIAL_DAYS, GRACE_DAYS)} />;
}
