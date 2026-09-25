import type { Metadata } from "next";
import { termosDeUso } from "@/content/legal";
import { GRACE_DAYS, TRIAL_DAYS } from "@/lib/stripe";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Termos de uso — GN Coleciona" };

export default function TermosPage() {
  return <LegalPage doc={termosDeUso(TRIAL_DAYS, GRACE_DAYS)} />;
}
