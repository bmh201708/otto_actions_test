import { Router } from "express";

export const nfcRouter = Router();

type FortuneEntry = {
  id: string;
  signNumber: number;
  title: string;
  theme: string;
  omen: "吉" | "中平" | "小吉";
  quote: string;
  interpretation: string;
  suggestion: string;
};

const fortunes: FortuneEntry[] = [
  {
    id: "fortune-sunrise",
    signNumber: 1,
    title: "晨光开局",
    theme: "行动签",
    omen: "吉",
    quote: "先迈出半步，运势才会追上你。",
    interpretation: "这是一支偏主动的签。今天适合先做最小动作，不必等到完全准备好才开始。",
    suggestion: "先完成一件 10 分钟就能收尾的小事，然后再决定下一步。"
  },
  {
    id: "fortune-mirror",
    signNumber: 2,
    title: "照见本心",
    theme: "人际签",
    omen: "中平",
    quote: "你越真诚，误会越容易散开。",
    interpretation: "这支签提醒你少一点猜测，多一点直接表达。今天的人际变化，不靠试探，靠说清楚。",
    suggestion: "给一个你在意的人发一条明确、简短、没有拐弯的消息。"
  },
  {
    id: "fortune-cloud",
    signNumber: 3,
    title: "云开见路",
    theme: "休整签",
    omen: "小吉",
    quote: "放松不是停滞，而是在为下一次起跳蓄力。",
    interpretation: "这支签更偏恢复与缓冲。今天适合降低一点节奏，让身体和脑子重新对齐。",
    suggestion: "给自己留一段不被打断的休息时间，再回来看最重要的事。"
  }
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

nfcRouter.get("/draw", (request, response) => {
  const tag = typeof request.query.tag === "string" ? request.query.tag.trim() : "";
  const seed = typeof request.query.seed === "string" ? request.query.seed.trim() : "";
  const explicitIndex = typeof request.query.index === "string" ? Number.parseInt(request.query.index, 10) : NaN;

  let selected: FortuneEntry;
  if (Number.isInteger(explicitIndex) && explicitIndex >= 1 && explicitIndex <= fortunes.length) {
    selected = fortunes[explicitIndex - 1];
  } else if (seed) {
    selected = fortunes[hashString(seed) % fortunes.length];
  } else {
    selected = fortunes[Math.floor(Math.random() * fortunes.length)];
  }

  return response.json({
    fortune: {
      ...selected,
      tag: tag || null,
      drawnAt: new Date().toISOString()
    }
  });
});

nfcRouter.get("/catalog", (_request, response) => {
  return response.json({
    fortunes: fortunes.map((fortune) => ({
      id: fortune.id,
      signNumber: fortune.signNumber,
      title: fortune.title,
      theme: fortune.theme,
      omen: fortune.omen
    }))
  });
});
