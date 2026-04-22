"use client";

type TopBarProps = {
  searchPlaceholder?: string;
  compactSearch?: boolean;
};

export function TopBar({ searchPlaceholder, compactSearch = false }: TopBarProps) {
  return (
    <header className="fixed right-0 top-0 z-30 hidden h-20 w-[calc(100%-16rem)] items-center justify-between border-b border-on-surface/5 bg-[#fbfbe2]/90 px-10 backdrop-blur-xl md:flex">
      <div className="font-display text-2xl font-black tracking-tight">Otto Systems</div>
      <div className="flex items-center gap-6">
        {searchPlaceholder ? (
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface/35">
              search
            </span>
            <input
              className={`rounded-full bg-surface-container-low pl-11 pr-4 text-sm text-on-surface/80 outline-none transition-all placeholder:text-on-surface/35 ${
                compactSearch ? "w-60 py-2.5" : "w-72 py-3"
              }`}
              placeholder={searchPlaceholder}
            />
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <button className="toolbar-icon">
            <span className="material-symbols-outlined">bookmark</span>
          </button>
          <button className="toolbar-icon">
            <span className="material-symbols-outlined">settings_input_antenna</span>
          </button>
          <button className="toolbar-icon">
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </div>
    </header>
  );
}
