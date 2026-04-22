"use client";

import Link from "next/link";

import type { NavKey } from "@/lib/types";

const items: Array<{ key: NavKey; href: string; label: string; icon: string }> = [
  { key: "control-center", href: "/control-center", label: "Control Center", icon: "settings_remote" },
  { key: "action-lab", href: "/action-lab", label: "Action Lab", icon: "architecture" },
  { key: "oracle", href: "/oracle", label: "Oracle", icon: "auto_awesome" },
  { key: "settings", href: "/settings", label: "Settings", icon: "settings" }
];

export function Sidebar({ active }: { active: NavKey }) {
  return (
    <nav className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-[#fbfbe2] py-8 shadow-[10px_0_30px_-15px_rgba(27,29,14,0.06)] md:flex">
      <div className="px-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <span className="material-symbols-outlined filled text-primary">smart_toy</span>
        </div>
        <h1 className="font-display text-[2rem] font-black leading-[1.05] tracking-tight text-primary">
          The Digital
          <br />
          Talisman
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.24em] text-on-surface/45">V0.4 Alchemy Edition</p>
      </div>
      <div className="mt-12 flex-1 space-y-2">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className={`nav-link ${active === item.key ? "nav-link-active" : ""}`}>
            <span className={`material-symbols-outlined text-[20px] ${active === item.key ? "filled" : ""}`}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="px-5">
        <button className="pill-button w-full bg-primary text-on-primary shadow-glow hover:scale-[1.02]">
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Calibrate Robot
        </button>
      </div>
    </nav>
  );
}
