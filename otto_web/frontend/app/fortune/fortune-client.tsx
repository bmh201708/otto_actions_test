"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FortunePayload = {
  id: string;
  signNumber: number;
  title: string;
  theme: "进" | "缓" | "转";
  omen: "吉" | "中吉" | "新机";
  quote: string;
  interpretation: string;
  suggestion: string;
  theaterChoice: "1" | "2" | "3";
  palette: string;
  tag: string | null;
  drawnAt: string;
};

type RobotTriggerPayload =
  | {
      ok: true;
      theaterChoice: "1" | "2" | "3";
      deduped?: boolean;
      cooldownMs?: number;
    }
  | {
      ok: false;
      theaterChoice: "1" | "2" | "3";
      error: string;
    };

const theaterLabels: Record<"1" | "2" | "3", string> = {
  "1": "剧场一 · 进",
  "2": "剧场二 · 缓",
  "3": "剧场三 · 转"
};

const tagLabels: Record<string, string> = {
  "1": "NFC 一",
  "2": "NFC 二",
  "3": "NFC 三",
  jin: "NFC · 进",
  huan: "NFC · 缓",
  zhuan: "NFC · 转",
  "进": "NFC · 进",
  "缓": "NFC · 缓",
  "转": "NFC · 转"
};

function themeTag(tag: string | null) {
  if (!tag) return "展台抽签";
  return tagLabels[tag] ?? `Tag ${tag}`;
}

function robotStatusView(robotTrigger: RobotTriggerPayload | null, theaterLabel: string) {
  if (!robotTrigger) {
    return {
      tone: "text-on-surface/70 bg-surface",
      dot: "bg-on-surface/30",
      title: "等待状态",
      body: "页面已打开，等待本次标签指令完成同步。"
    };
  }

  if (robotTrigger.ok && robotTrigger.deduped) {
    return {
      tone: "text-[#7b4b00] bg-[#fff3cf]",
      dot: "bg-[#e6a100]",
      title: "冷却中",
      body: `这个标签刚刚已经触发过一次，Otto 不会重复进入 ${theaterLabel}。`
    };
  }

  if (robotTrigger.ok) {
    return {
      tone: "text-[#0f6b45] bg-[#dff7ea]",
      dot: "bg-[#18a86b]",
      title: "剧场已启动",
      body: `Otto 已收到签文，正在进入 ${theaterLabel}。`
    };
  }

  return {
    tone: "text-[#8e1f1f] bg-[#ffe3e1]",
    dot: "bg-[#cf2f2f]",
    title: "触发失败",
    body: `签文已经抽出，但机器人触发失败：${robotTrigger.error ?? "未知错误"}`
  };
}

export function FortuneClient({ tag }: { tag: string | null }) {
  const didAutoDrawRef = useRef(false);
  const [fortune, setFortune] = useState<FortunePayload | null>(null);
  const [robotTrigger, setRobotTrigger] = useState<RobotTriggerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (tag) params.set("tag", tag);

      const response = await fetch(`/api/nfc/draw?${params.toString()}`, {
        cache: "no-store"
      });
      const body = (await response.json().catch(() => ({ error: "Request failed" }))) as {
        fortune?: FortunePayload;
        robotTrigger?: RobotTriggerPayload;
        error?: string;
      };

      if (!response.ok || !body.fortune) {
        throw new Error(body.error ?? "Unable to draw fortune");
      }

      setFortune(body.fortune);
      setRobotTrigger(body.robotTrigger ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to draw fortune");
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    if (didAutoDrawRef.current) {
      return;
    }
    didAutoDrawRef.current = true;
    void draw();
  }, [draw]);

  const statusView = fortune ? robotStatusView(robotTrigger, theaterLabels[fortune.theaterChoice]) : null;

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(183,16,42,0.16),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.36),transparent_22%),var(--surface)] px-4 py-5 text-on-surface sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="fortune-float absolute -left-8 top-16 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(219,49,63,0.18),transparent_66%)] blur-2xl" />
        <div className="fortune-float absolute right-0 top-1/3 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(92,79,134,0.18),transparent_66%)] blur-2xl [animation-delay:1.1s]" />
        <div className="absolute inset-x-6 top-28 h-px bg-[linear-gradient(90deg,transparent,rgba(183,16,42,0.35),transparent)]" />
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-[2.6rem] bg-[rgba(251,251,226,0.92)] shadow-[0_30px_100px_-44px_rgba(27,29,14,0.42)] backdrop-blur">
          <div className="relative overflow-hidden border-b border-outline-variant/25 px-6 pb-8 pt-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.28),transparent_60%)]" />
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-on-surface/45">
              <span>Otto 展览签文</span>
              <span>{themeTag(tag)}</span>
            </div>

            <div className="relative mt-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-on-surface/42">扫码已识别 · 互动剧场开启</p>
                <h1 className="mt-2 font-display text-[4.5rem] font-black tracking-tight">签启</h1>
                <p className="mt-2 max-w-[14rem] text-sm leading-7 text-on-surface/62">
                  这是 Otto 的线下展陈签文页。每个 NFC 标签都会引出一种不同的节奏与剧场方向。
                </p>
              </div>
              <div className="fortune-float relative flex h-20 w-20 items-center justify-center rounded-full bg-surface-container shadow-[inset_0_10px_24px_rgba(255,255,255,0.7),0_18px_36px_-22px_rgba(27,29,14,0.36)]">
                <div className="fortune-pulse absolute inset-2 rounded-full" />
                <span className="material-symbols-outlined text-[34px] text-primary">nfc</span>
              </div>
            </div>
          </div>

          <div className="px-6 pb-7 pt-6">
            {loading ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <p className="mt-5 text-sm uppercase tracking-[0.24em] text-on-surface/45">Otto is Receiving the Sign</p>
              </div>
            ) : error ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-[44px] text-primary">warning</span>
                <p className="mt-4 font-display text-3xl font-bold">签文加载失败</p>
                <p className="mt-3 max-w-sm text-sm leading-7 text-on-surface/62">{error}</p>
              </div>
            ) : fortune ? (
              <div>
                <div className={`fortune-sweep relative rounded-[2.2rem] bg-gradient-to-br ${fortune.palette} p-[1px] shadow-[0_22px_54px_-28px_rgba(27,29,14,0.38)]`}>
                  <div className="rounded-[calc(2.2rem-1px)] bg-[linear-gradient(180deg,rgba(255,255,255,0.24),transparent_18%),rgba(251,251,226,0.97)] px-5 py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface/44">
                          第 {fortune.signNumber} 签 · 主题 {fortune.theme}
                        </p>
                        <h2 className="mt-3 font-display text-[4rem] font-black leading-none tracking-tight">
                          {fortune.title}
                        </h2>
                      </div>
                      <div className="rounded-full bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                        {fortune.omen}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-4 rounded-[1.7rem] bg-surface-container-low px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
                      <p className="font-display text-[1.9rem] leading-10 text-primary">“{fortune.quote}”</p>
                      <div className="rounded-full border border-outline-variant/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/48">
                        Theme {fortune.theme}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_18%),var(--surface-container-low)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/42">Otto 剧场反馈</p>
                      <h3 className="mt-2 font-display text-3xl font-black">{theaterLabels[fortune.theaterChoice]}</h3>
                    </div>
                    <div className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] ${statusView?.tone}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${statusView?.dot} ${robotTrigger?.ok && !robotTrigger.deduped ? "fortune-pulse" : ""}`} />
                      {statusView?.title}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.4rem] bg-surface px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <div className="mb-3 flex items-center gap-3 text-primary">
                      <span className="material-symbols-outlined text-[22px]">
                        {robotTrigger?.ok && !robotTrigger.deduped ? "motion_photos_on" : robotTrigger?.ok ? "schedule" : "release_alert"}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/42">
                        Live Stage Signal
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-on-surface/72">{statusView?.body}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-5 rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_18%),var(--surface-container-low)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/42">签文解释</p>
                    <p className="mt-3 text-base leading-8 text-on-surface/72">{fortune.interpretation}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/42">今日建议</p>
                    <p className="mt-3 text-base leading-8 text-on-surface/72">{fortune.suggestion}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.8rem] border border-outline-variant/30 bg-[rgba(255,255,255,0.36)] px-5 py-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface/38">Otto Exhibition Prompt</p>
                  <p className="mt-3 font-display text-2xl leading-9 text-primary">
                    扫描标签，签文落下，机器人随之入场。
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
