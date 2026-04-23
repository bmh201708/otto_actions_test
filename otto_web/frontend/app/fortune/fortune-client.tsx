"use client";

import { useCallback, useEffect, useState } from "react";

type FortunePayload = {
  id: string;
  signNumber: number;
  title: string;
  theme: string;
  omen: "吉" | "中平" | "小吉";
  quote: string;
  interpretation: string;
  suggestion: string;
  tag: string | null;
  drawnAt: string;
};

function buildSeed(tag: string | null) {
  const timestamp = Date.now();
  return tag ? `${tag}-${timestamp}` : `${timestamp}`;
}

export function FortuneClient({ tag }: { tag: string | null }) {
  const [fortune, setFortune] = useState<FortunePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(
    async (nextSeed = buildSeed(tag)) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (tag) params.set("tag", tag);
        params.set("seed", nextSeed);

        const response = await fetch(`/api/nfc/draw?${params.toString()}`, {
          cache: "no-store"
        });
        const body = (await response.json().catch(() => ({ error: "Request failed" }))) as {
          fortune?: FortunePayload;
          error?: string;
        };

        if (!response.ok || !body.fortune) {
          throw new Error(body.error ?? "Unable to draw fortune");
        }

        setFortune(body.fortune);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to draw fortune");
      } finally {
        setLoading(false);
      }
    },
    [tag]
  );

  useEffect(() => {
    void draw();
  }, [draw]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(183,16,42,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.32),transparent_24%),var(--surface)] px-5 py-8 text-on-surface sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-between rounded-[2.5rem] bg-[rgba(251,251,226,0.88)] p-6 shadow-[0_24px_80px_-36px_rgba(27,29,14,0.32)] backdrop-blur md:p-8">
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface/45">
            <span>Otto Fortune NFC</span>
            <span>{tag ? `Tag ${tag}` : "Open Draw"}</span>
          </div>

          <div className="mt-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-container shadow-[inset_0_8px_24px_rgba(255,255,255,0.7)]">
              <span className="material-symbols-outlined text-[34px] text-primary">instant_mix</span>
            </div>
            <h1 className="mt-5 font-display text-5xl font-black tracking-tight sm:text-6xl">抽一支签</h1>
            <p className="mt-3 text-sm leading-7 text-on-surface/60">
              扫到标签后，这里会随机落下一支签文。今天先看它想提醒你什么。
            </p>
          </div>

          <section className="mt-8 rounded-[2rem] bg-surface-container-low p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            {loading ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <p className="mt-5 text-sm uppercase tracking-[0.22em] text-on-surface/45">Drawing Fortune</p>
              </div>
            ) : error ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-[42px] text-primary">warning</span>
                <p className="mt-4 font-display text-3xl font-bold">抽签失败</p>
                <p className="mt-3 max-w-sm text-sm leading-7 text-on-surface/62">{error}</p>
              </div>
            ) : fortune ? (
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface/45">
                      第 {fortune.signNumber} 签 · {fortune.theme}
                    </p>
                    <h2 className="mt-3 font-display text-4xl font-black leading-tight">{fortune.title}</h2>
                  </div>
                  <div className="rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-on-primary">
                    {fortune.omen}
                  </div>
                </div>

                <div className="mt-6 rounded-[1.6rem] bg-surface px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <p className="font-display text-2xl leading-10 text-primary">“{fortune.quote}”</p>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/42">签文解释</p>
                    <p className="mt-3 text-base leading-8 text-on-surface/72">{fortune.interpretation}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/42">今日建议</p>
                    <p className="mt-3 text-base leading-8 text-on-surface/72">{fortune.suggestion}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="mt-8">
          <button
            className="pill-button w-full bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-[0_18px_32px_-20px_rgba(183,16,42,0.65)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => {
              void draw();
            }}
          >
            {loading ? "抽签中..." : "再抽一次"}
          </button>
          <p className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-on-surface/38">
            用 NFC 标签打开这个页面即可直接抽签
          </p>
        </div>
      </div>
    </main>
  );
}
