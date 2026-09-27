"use client";

import { PLATFORM_NAME } from "@/lib/brand";
import BrandLogo from "./BrandLogo";
import { HeaderActions, NavSwitch } from "./HeaderIcons";
import UserMenu from "./UserMenu";

// Topo das páginas de conta (Meu perfil, Assinatura): marca, título e navegação.
export default function AccountHeader({
  title,
  email,
  shop,
}: {
  title: string;
  email: string | null;
  shop: { href: string; active: boolean };
}) {
  return (
    <div className="header">
      <div className="header-inner">
        <div className="header-main-row">
          <div className="brand">
            <BrandLogo />
            <span className="kicker">{PLATFORM_NAME}</span>
            <span className="title">{title}</span>
          </div>
          <HeaderActions>
            <NavSwitch active={null} shopHref={shop.href} />
            <UserMenu email={email} shopActive={shop.active} />
          </HeaderActions>
        </div>
      </div>
    </div>
  );
}
