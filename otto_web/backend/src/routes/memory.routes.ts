import { MemoryKind, MemoryStatus } from "@prisma/client";
import { Router } from "express";

import {
  archiveUserMemory,
  extractAndStoreConversationMemories,
  listUserMemories,
  updateUserMemory
} from "../services/memory.service";

export const memoryRouter = Router();

memoryRouter.get("/", async (request, response) => {
  const kind = request.query.kind as string | undefined;
  const status = request.query.status as string | undefined;

  const memories = await listUserMemories(request.user!.sub, {
    kind: kind && Object.values(MemoryKind).includes(kind as MemoryKind) ? (kind as MemoryKind) : undefined,
    status:
      status && Object.values(MemoryStatus).includes(status as MemoryStatus) ? (status as MemoryStatus) : undefined
  });

  return response.json({ memories });
});

memoryRouter.patch("/:id", async (request, response) => {
  try {
    const memory = await updateUserMemory(request.user!.sub, request.params.id, request.body ?? {});
    return response.json({ memory });
  } catch (error) {
    return response.status(404).json({ error: error instanceof Error ? error.message : "Unable to update memory" });
  }
});

memoryRouter.post("/:id/archive", async (request, response) => {
  try {
    const memory = await archiveUserMemory(request.user!.sub, request.params.id);
    return response.json({ memory });
  } catch (error) {
    return response.status(404).json({ error: error instanceof Error ? error.message : "Unable to archive memory" });
  }
});

memoryRouter.post("/extract", async (request, response) => {
  try {
    const { conversationId, userInput, assistantReply } = request.body as {
      conversationId?: string;
      userInput?: string;
      assistantReply?: string;
    };

    const memories = await extractAndStoreConversationMemories({
      userId: request.user!.sub,
      conversationId,
      userInput,
      assistantReply
    });

    return response.status(201).json({ memories });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Unable to extract memory" });
  }
});
