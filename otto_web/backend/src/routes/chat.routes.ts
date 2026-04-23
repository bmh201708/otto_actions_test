import { Router } from "express";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { prisma } from "../lib/prisma";
import { createChatStream } from "../services/openai.service";
import { loadConversationTurnContext, runToolPlanningLoop } from "../services/chat-orchestrator.service";
import { extractAndStoreUserMemories, shouldEmitMemoryDebug } from "../services/memory.service";
import { buildFinalResponseMessages } from "../services/otto-tools.service";
import { openSse, sendSse } from "../services/sse";

export const chatRouter = Router();

chatRouter.post("/messages", async (request, response) => {
  const { conversationId, content } = request.body as { conversationId?: string | null; content?: string };
  const trimmed = content?.trim();

  if (!trimmed) {
    return response.status(400).json({ error: "Message content is required" });
  }

  const conversation = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId }
      })
    : null;

  const activeConversation =
    conversation ??
    (await prisma.conversation.create({
      data: {
        title: trimmed.slice(0, 48),
        userId: request.user?.sub
      }
    }));

  await prisma.message.create({
    data: {
      conversationId: activeConversation.id,
      role: "user",
      content: trimmed
    }
  });

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: activeConversation.id,
      role: "assistant",
      content: "",
      model: process.env.LLM_MODEL ?? null
    }
  });

  return response.status(201).json({
    conversationId: activeConversation.id,
    assistantMessageId: assistantMessage.id
  });
});

chatRouter.get("/conversations", async (_request, response) => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20
  });
  return response.json({ conversations });
});

chatRouter.get("/conversations/:id/messages", async (request, response) => {
  const messages = await prisma.message.findMany({
    where: { conversationId: request.params.id },
    orderBy: { createdAt: "asc" }
  });
  return response.json({ messages });
});

chatRouter.get("/stream/:conversationId", async (request, response) => {
  const assistantMessageId = request.query.assistantMessageId as string | undefined;
  const conversation = await prisma.conversation.findUnique({
    where: { id: request.params.conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!conversation || !assistantMessageId) {
    return response.status(404).json({ error: "Conversation not found" });
  }

  openSse(response);

  try {
    const userId = request.user!.sub;
    const baseMessages: ChatCompletionMessageParam[] = conversation.messages
      .filter((message) => !(message.id === assistantMessageId && message.role === "assistant"))
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    const latestUserMessage = [...conversation.messages]
      .reverse()
      .find((message) => !(message.id === assistantMessageId) && message.role === "user");

    const { memoryContext, memoryDebug, hasMemoryDebug } = await loadConversationTurnContext(
      userId,
      conversation.messages.filter((message) => !(message.id === assistantMessageId && message.role === "assistant"))
    );
    if (hasMemoryDebug && shouldEmitMemoryDebug()) {
      sendSse(response, "chat.memory_hits", {
        memories: memoryDebug
      });
    }

    const plannedMessages = await runToolPlanningLoop(baseMessages, memoryContext, async (event) => {
      if (event.type === "tool_call") {
        sendSse(response, "chat.tool_call", {
          name: event.name,
          arguments: event.arguments
        });
      } else {
        sendSse(response, "chat.tool_result", {
          name: event.name,
          result: event.result
        });
      }
    });
    const finalMessages = buildFinalResponseMessages(plannedMessages, memoryContext);

    const stream = await createChatStream(finalMessages);
    let assistantContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (!delta) continue;
      assistantContent += delta;
      sendSse(response, "chat.delta", { chunk: delta });
    }

    await prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        content: assistantContent,
        model: process.env.LLM_MODEL ?? null
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    if (latestUserMessage?.content.trim() && assistantContent.trim()) {
      void extractAndStoreUserMemories({
        userId,
        userInput: latestUserMessage.content,
        assistantReply: assistantContent
      });
    }

    sendSse(response, "chat.done", { ok: true });
    return response.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat stream failed";
    sendSse(response, "chat.error", { error: message });
    return response.end();
  }
});
