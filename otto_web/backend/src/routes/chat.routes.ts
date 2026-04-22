import { Router } from "express";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { prisma } from "../lib/prisma";
import { createChatStream } from "../services/openai.service";
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
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are Otto's oracle-grade operator copilot. Give concise, grounded guidance that can help drive robot actions and exhibition interactions."
      },
      ...conversation.messages
        .filter((message) => !(message.id === assistantMessageId && message.role === "assistant"))
        .map((message) => ({
          role: message.role,
          content: message.content
        }))
    ];

    const stream = await createChatStream(messages);
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

    sendSse(response, "chat.done", { ok: true });
    return response.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat stream failed";
    sendSse(response, "chat.error", { error: message });
    return response.end();
  }
});
