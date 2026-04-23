import { Router } from "express";

import { listActionSpecs } from "../services/otto-action-specs.service";
import { ottoDevice as device } from "../services/otto-device";

export const robotRouter = Router();

function isRequestValidationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Unsupported action key") ||
    error.message.includes("Unsupported params") ||
    error.message.includes("Missing required") ||
    error.message.includes("must be") ||
    error.message.includes("Expected")
  );
}

robotRouter.get("/status", async (_request, response) => {
  try {
    const status = await device.getStatus();
    return response.json({ status });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to fetch robot status" });
  }
});

robotRouter.get("/actions", async (_request, response) => {
  return response.json({ actions: listActionSpecs() });
});

robotRouter.post("/actions/:actionKey/execute", async (request, response) => {
  try {
    const status = await device.executeAction(request.params.actionKey, request.body ?? null);
    return response.json({ status });
  } catch (error) {
    const statusCode = isRequestValidationError(error) ? 400 : 502;
    return response.status(statusCode).json({ error: error instanceof Error ? error.message : "Unable to execute action" });
  }
});

robotRouter.post("/move", async (request, response) => {
  try {
    const { direction } = request.body as { direction?: string };
    const status = await device.move(direction ?? "forward");
    return response.json({ status });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to move robot" });
  }
});

robotRouter.post("/speak", async (request, response) => {
  try {
    const { text } = request.body as { text?: string };
    const status = await device.speak(text ?? "");
    return response.json({ status });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to send speak command" });
  }
});

robotRouter.post("/calibrate", async (_request, response) => {
  try {
    const status = await device.calibrate();
    return response.json({ status });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to calibrate robot" });
  }
});
