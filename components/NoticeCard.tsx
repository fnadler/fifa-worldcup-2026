import Link from "next/link";
import type { ReactNode } from "react";

interface NoticeCardProps {
  kicker: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export default function NoticeCard({ kicker, children, backHref, backLabel }: NoticeCardProps) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">
          <span className="kicker">{kicker}</span>
          <span className="title">Álbum Copa 2026</span>
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
