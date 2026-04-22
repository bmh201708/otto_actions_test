import { Router } from "express";

import { env, isLlmConfigured } from "../config/env";
import { requireAuth } from "../middleware/auth";

export const systemRouter = Router();

systemRouter.get("/health", (_request, response) => {
  return response.json({ ok: true });
});

systemRouter.get("/config", requireAuth, (_request, response) => {
  return response.json({
    config: {
      llmConfigured: isLlmConfigured(),
      model: env.LLM_MODEL || null,
      baseUrl: env.LLM_BASE_URL || null,
      robotMode: env.ROBOT_MODE
    }
  });
});
