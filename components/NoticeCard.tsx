import Link from "next/link";
import type { ReactNode } from "react";
import BrandLogo from "./BrandLogo";
import { PLATFORM_NAME } from "@/lib/brand";

interface NoticeCardProps {
  kicker: string;
  /** Título grande; padrão = nome da plataforma. */
  title?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export default function NoticeCard({ kicker, title = PLATFORM_NAME, children, backHref, backLabel }: NoticeCardProps) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">
          <BrandLogo />
          <span className="kicker">{kicker}</span>
          <span className="title">{title}</span>
        </div>
        <p className="modal-notice" style={{ textAlign: "center", margin: 0 }}>
          {children}
        </p>
        {backHref && (
          <Link href={backHref} className="btn-ghost" style={{ textAlign: "center" }}>
            {backLabel ?? "Voltar"}
          </Link>
        )}
      </div>
    </div>
  );
}
