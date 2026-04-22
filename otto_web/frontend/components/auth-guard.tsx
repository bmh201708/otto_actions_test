"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading } = useAuth(true);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="paper-card flex h-48 w-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
            <p className="font-display text-2xl">Summoning the control scroll…</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
