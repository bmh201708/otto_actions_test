import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { requireAuth } from "./middleware/auth";
import { actionLabRouter } from "./routes/action-lab.routes";
import { authRouter } from "./routes/auth.routes";
import { chatRouter } from "./routes/chat.routes";
import { memoryRouter } from "./routes/memory.routes";
import { oracleRouter } from "./routes/oracle.routes";
import { robotRouter } from "./routes/robot.routes";
import { systemRouter } from "./routes/system.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser(env.COOKIE_SECRET));

  app.use("/api", systemRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/robot", requireAuth, robotRouter);
  app.use("/api/oracle", requireAuth, oracleRouter);
  app.use("/api/action-lab", requireAuth, actionLabRouter);
  app.use("/api/chat", requireAuth, chatRouter);
  app.use("/api/memory", requireAuth, memoryRouter);

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: error.message || "Internal server error" });
  });

  return app;
}
