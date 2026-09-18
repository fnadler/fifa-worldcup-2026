"use client";

import type { AppUser } from "@/lib/types";

interface AuthBarProps {
  user: AppUser;
  onSignOut: () => void;
}

export default function AuthBar({ user, onSignOut }: AuthBarProps) {
  return (
    <div className="auth-bar">
      <span className="auth-status">{user.email}</span>
      <button type="button" className="btn-ghost" onClick={onSignOut}>
        Sair
      </button>
    </div>
  );
}
