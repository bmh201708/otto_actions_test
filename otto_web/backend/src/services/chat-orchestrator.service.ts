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
import { ottoDevice } from "./otto-device";

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

export type ToolPlanningResult = {
  messages: ChatCompletionMessageParam[];
  usedSpeakTool: boolean;
};

export async function runToolPlanningLoop(
  messages: ChatCompletionMessageParam[],
  memoryContext: string,
  onEvent?: (event: ToolExecutionEvent) => void | Promise<void>
): Promise<ToolPlanningResult> {
  const loopMessages = [...messages];
  let usedSpeakTool = false;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const completion = await createToolPlanningCompletion(buildToolPlanningMessages(loopMessages, memoryContext), ottoTools);
    const assistantMessage = completion.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;

    if (!toolCalls?.length) {
      return {
        messages: loopMessages,
        usedSpeakTool
      };
    }

    if (toolCalls.some((toolCall) => toolCall.function.name === "otto_speak")) {
      usedSpeakTool = true;
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

  return {
    messages: loopMessages,
    usedSpeakTool
  };
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
  autoSpeakShortReply?: boolean;
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
  const planning = await runToolPlanningLoop(baseMessages, memoryContext, input.onEvent);
  const finalMessages = buildFinalResponseMessages(planning.messages, memoryContext);
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

  const autoSpeakTriggered =
    input.autoSpeakShortReply !== false
      ? await autoSpeakShortReplyIfNeeded(assistantReply, {
          usedSpeakTool: planning.usedSpeakTool
        })
      : false;

  return {
    conversation,
    assistantMessage,
    assistantReply,
    autoSpeakTriggered,
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

export async function autoSpeakShortReplyIfNeeded(
  assistantReply: string,
  input: {
    usedSpeakTool: boolean;
  }
) {
  if (input.usedSpeakTool) {
    return false;
  }

  const speechText = normalizeAssistantReplyForSpeech(assistantReply);
  if (!shouldAutoSpeakReply(speechText)) {
    return false;
  }

  await ottoDevice.speak(speechText);
  return true;
}

function normalizeAssistantReplyForSpeech(reply: string) {
  return reply
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[>#*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldAutoSpeakReply(reply: string) {
  if (!reply) {
    return false;
  }

  if (/https?:\/\//i.test(reply)) {
    return false;
  }

  if (reply.includes("\n")) {
    return false;
  }

  const sentenceCount = reply
    .split(/[。！？!?；;]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  return reply.length <= 72 && sentenceCount <= 3;
}
