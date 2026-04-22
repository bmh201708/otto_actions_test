import { Router } from "express";

import { prisma } from "../lib/prisma";
import { MockOttoDeviceService } from "../services/mock-otto-device.service";

export const robotRouter = Router();
const device = new MockOttoDeviceService(prisma);

robotRouter.get("/status", async (_request, response) => {
  const status = await device.getStatus();
  return response.json({ status });
});

robotRouter.post("/actions/:actionKey/execute", async (request, response) => {
  try {
    const status = await device.executeAction(request.params.actionKey, request.body ?? null);
    return response.json({ status });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Unable to execute action" });
  }
});

robotRouter.post("/move", async (request, response) => {
  const { direction } = request.body as { direction?: string };
  const status = await device.move(direction ?? "forward");
  return response.json({ status });
});

robotRouter.post("/speak", async (request, response) => {
  const { text } = request.body as { text?: string };
  const status = await device.speak(text ?? "");
  return response.json({ status });
});

robotRouter.post("/calibrate", async (_request, response) => {
  const status = await device.calibrate();
  return response.json({ status });
});
