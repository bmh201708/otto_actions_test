import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import type { NavKey } from "@/lib/types";

type AppShellProps = {
  active: NavKey;
  children: ReactNode;
  searchPlaceholder?: string;
  compactSearch?: boolean;
};

export function AppShell({ active, children, searchPlaceholder, compactSearch }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar active={active} />
      <TopBar searchPlaceholder={searchPlaceholder} compactSearch={compactSearch} />
      <main className="ml-0 min-h-screen pt-24 md:ml-64">{children}</main>
    </div>
  );
}
