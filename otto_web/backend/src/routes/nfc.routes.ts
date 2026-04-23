import { Router } from "express";

import { ottoDevice } from "../services/otto-device";

export const nfcRouter = Router();

type FortuneEntry = {
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
};

const fortunes: Record<"1" | "2" | "3", FortuneEntry> = {
  "1": {
    id: "fortune-forward",
    signNumber: 1,
    title: "进",
    theme: "进",
    omen: "吉",
    quote: "先动起来，路才会在你脚下显形。",
    interpretation: "这是一支偏向推进与出手的签。今天比起继续观望，更适合做出一个明确动作，让局面向前滚动。",
    suggestion: "选一件最重要的事，立刻开始第一步，不等状态完美。",
    theaterChoice: "1",
    palette: "from-[#b7102a] to-[#db313f]"
  },
  "2": {
    id: "fortune-soften",
    signNumber: 2,
    title: "缓",
    theme: "缓",
    omen: "中吉",
    quote: "慢下来，不是退后，而是在给节奏让位。",
    interpretation: "这支签更适合休整和降噪。今天不必硬撑，把速度调低一点，反而更容易看清真正重要的事。",
    suggestion: "给自己一段不被打断的空白时间，再回来处理眼前的问题。",
    theaterChoice: "2",
    palette: "from-[#8c5a58] to-[#b78a74]"
  },
  "3": {
    id: "fortune-turn",
    signNumber: 3,
    title: "转",
    theme: "转",
    omen: "新机",
    quote: "当你愿意转身，新的入口才会出现。",
    interpretation: "这是一支关于转向和变化的签。今天适合换个角度、换个方法、或者换一条靠近目标的路。",
    suggestion: "如果原来的方法卡住了，先改一个方向，再继续前进。",
    theaterChoice: "3",
    palette: "from-[#5c4f86] to-[#7f6eb1]"
  }
};

const NFC_TRIGGER_COOLDOWN_MS = 12000;
const lastTriggerAtByKey = new Map<string, number>();

function resolveFortune(tagValue: string | null) {
  const normalized = (tagValue ?? "").trim().toLowerCase();

  if (normalized === "1" || normalized === "jin" || normalized === "进" || normalized === "forward") {
    return fortunes["1"];
  }
  if (normalized === "2" || normalized === "huan" || normalized === "缓" || normalized === "slow") {
    return fortunes["2"];
  }
  if (normalized === "3" || normalized === "zhuan" || normalized === "转" || normalized === "turn") {
    return fortunes["3"];
  }

  const choices = Object.values(fortunes);
  return choices[Math.floor(Math.random() * choices.length)];
}

nfcRouter.get("/draw", async (request, response) => {
  const tag = typeof request.query.tag === "string" ? request.query.tag.trim() : null;
  const fortune = resolveFortune(tag);
  const triggerKey = (tag && tag.length > 0 ? tag : fortune.id).toLowerCase();
  const now = Date.now();
  const lastTriggeredAt = lastTriggerAtByKey.get(triggerKey) ?? 0;
  const withinCooldown = now - lastTriggeredAt < NFC_TRIGGER_COOLDOWN_MS;

  let robotTrigger:
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
  } = {
    ok: true,
    theaterChoice: fortune.theaterChoice
  };

  if (withinCooldown) {
    robotTrigger = {
      ok: true,
      theaterChoice: fortune.theaterChoice,
      deduped: true,
      cooldownMs: Math.max(0, NFC_TRIGGER_COOLDOWN_MS - (now - lastTriggeredAt))
    };
  } else {
    try {
      await ottoDevice.executeTheater(fortune.theaterChoice);
      lastTriggerAtByKey.set(triggerKey, now);
    } catch (error) {
      robotTrigger = {
        ok: false,
        theaterChoice: fortune.theaterChoice,
        error: error instanceof Error ? error.message : "Unable to trigger theater"
      };
    }
  }

  return response.json({
    fortune: {
      ...fortune,
      tag,
      drawnAt: new Date().toISOString()
    },
    robotTrigger
  });
});

nfcRouter.get("/catalog", (_request, response) => {
  return response.json({
    fortunes: Object.values(fortunes).map((fortune) => ({
      id: fortune.id,
      signNumber: fortune.signNumber,
      title: fortune.title,
      theme: fortune.theme,
      omen: fortune.omen,
      theaterChoice: fortune.theaterChoice
    }))
  });
});
