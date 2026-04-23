import type { Message, Prisma } from "@prisma/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { prisma } from "../lib/prisma";
import { createChatCompletion, createToolPlanningCompletion } from "./openai.service";
import {
  extractAndStoreUserMemories,
  getMemoryContext,
  markMemoriesUsed,
  shouldEmitMemoryDebug,
  toMemoryDebugPayload
} from "./memory.service";
import {
  buildFinalResponseMessages,
  buildToolPlanningMessages,
  executeToolCalls,
  ottoTools
} from "./otto-tools.service";

export type ToolExecutionEvent =
  | {
      type: "tool_call";
      name: string;
      arguments: unknown;
    }
  | {
      type: "tool_result";
      name: string;
      result: unknown;
    };

export async function runToolPlanningLoop(
  messages: ChatCompletionMessageParam[],
  memoryContext: string,
  onEvent?: (event: ToolExecutionEvent) => void | Promise<void>
) {
  const loopMessages = [...messages];

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const completion = await createToolPlanningCompletion(buildToolPlanningMessages(loopMessages, memoryContext), ottoTools);
    const assistantMessage = completion.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;

    if (!toolCalls?.length) {
      return loopMessages;
    }

    loopMessages.push({
      role: "assistant",
      content: null,
      tool_calls: toolCalls
    });

    const { events, toolMessages } = await executeToolCalls(toolCalls);
    for (const event of events) {
      await onEvent?.(event);
    }
    loopMessages.push(...toolMessages);
  }

  return loopMessages;
}

export async function loadConversationTurnContext(userId: string, messages: Message[]) {
  const { memories, context: memoryContext } = await getMemoryContext(userId);
  if (memories.length) {
    await markMemoriesUsed(memories.map((memory) => memory.id));
  }

  const baseMessages: ChatCompletionMessageParam[] = messages.map((message) => ({
    role: message.role,
    content: message.content
  }));

  return {
    baseMessages,
    memoryContext,
    memoryDebug: shouldEmitMemoryDebug() ? toMemoryDebugPayload(memories) : [],
    hasMemoryDebug: memories.length > 0 && shouldEmitMemoryDebug()
  };
}

export async function runPersistedAssistantTurn(input: {
  userId: string;
  content: string;
  conversationId?: string | null;
  assistantModel?: string | null;
  onEvent?: (event: ToolExecutionEvent) => void | Promise<void>;
}) {
  const trimmed = input.content.trim();
  if (!trimmed) {
    throw new Error("Message content is required");
  }

  const existingConversation = input.conversationId
    ? await prisma.conversation.findUnique({
        where: { id: input.conversationId }
      })
    : null;

  const conversation =
    existingConversation ??
    (await prisma.conversation.create({
      data: {
        title: trimmed.slice(0, 48),
        userId: input.userId
      }
    }));

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: trimmed
    }
  });

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" }
  });

  const { baseMessages, memoryContext, memoryDebug, hasMemoryDebug } = await loadConversationTurnContext(input.userId, messages);
  const plannedMessages = await runToolPlanningLoop(baseMessages, memoryContext, input.onEvent);
  const finalMessages = buildFinalResponseMessages(plannedMessages, memoryContext);
  const completion = await createChatCompletion(finalMessages);
  const assistantReply = completion.choices[0]?.message?.content?.trim() ?? "";

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: assistantReply,
      model: input.assistantModel ?? null
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() }
  });

  if (trimmed && assistantReply) {
    void extractAndStoreUserMemories({
      userId: input.userId,
      userInput: trimmed,
      assistantReply
    });
  }

  return {
    conversation,
    assistantMessage,
    assistantReply,
    memoryDebug: hasMemoryDebug ? memoryDebug : []
  };
}

export function normalizeVoiceTranscript(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

export function buildConversationMessageSnapshot(messages: Message[], excludeMessageId?: string) {
  return messages
    .filter((message) => message.id !== excludeMessageId)
    .map(
      (message) =>
        ({
          role: message.role,
          content: message.content
        }) satisfies ChatCompletionMessageParam
    );
}

export function toPrismaJson(value: unknown): Prisma.JsonValue {
  return value as Prisma.JsonValue;
}
