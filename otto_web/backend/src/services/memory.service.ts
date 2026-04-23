import {
  MemoryKind,
  MemorySource,
  MemoryStatus,
  type Prisma,
  type UserMemory
} from "@prisma/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { prisma } from "../lib/prisma";
import { createChatCompletion, LlmNotConfiguredError } from "./openai.service";

const STABLE_MEMORY_KINDS = new Set<MemoryKind>(["profile", "preference", "constraint"]);
const INTERACTION_MEMORY_KINDS = new Set<MemoryKind>(["interaction_style", "favorite_action", "memory_summary"]);

type MemoryCandidate = {
  kind: MemoryKind;
  summary: string;
  content: string;
  salience: number;
};

type MemoryFilters = {
  kind?: MemoryKind;
  status?: MemoryStatus;
};

export async function listUserMemories(userId: string, filters: MemoryFilters = {}) {
  return prisma.userMemory.findMany({
    where: {
      userId,
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.status ? { status: filters.status } : {})
    },
    orderBy: [{ salience: "desc" }, { lastUsedAt: "desc" }, { updatedAt: "desc" }]
  });
}

export async function updateUserMemory(
  userId: string,
  memoryId: string,
  input: Partial<Pick<UserMemory, "summary" | "content" | "salience" | "kind" | "status">>
) {
  const existing = await prisma.userMemory.findFirst({
    where: {
      id: memoryId,
      userId
    }
  });

  if (!existing) {
    throw new Error("Memory not found");
  }

  return prisma.userMemory.update({
    where: { id: memoryId },
    data: {
      summary: input.summary ?? existing.summary,
      content: input.content ?? existing.content,
      salience: input.salience !== undefined ? clampSalience(input.salience) : existing.salience,
      kind: input.kind ?? existing.kind,
      status: input.status ?? existing.status
    }
  });
}

export async function archiveUserMemory(userId: string, memoryId: string) {
  return updateUserMemory(userId, memoryId, { status: MemoryStatus.archived });
}

export async function getMemoryContext(userId: string, limit = 8) {
  const memories = await prisma.userMemory.findMany({
    where: {
      userId,
      status: MemoryStatus.active
    },
    orderBy: [{ salience: "desc" }, { lastUsedAt: "desc" }, { updatedAt: "desc" }],
    take: limit
  });

  const stableProfile = memories.filter((memory) => STABLE_MEMORY_KINDS.has(memory.kind));
  const interactionHints = memories.filter((memory) => INTERACTION_MEMORY_KINDS.has(memory.kind));

  return {
    memories,
    context: buildMemoryContextBlock(stableProfile, interactionHints)
  };
}

export async function markMemoriesUsed(memoryIds: string[]) {
  if (!memoryIds.length) {
    return;
  }

  await prisma.userMemory.updateMany({
    where: {
      id: { in: memoryIds }
    },
    data: {
      lastUsedAt: new Date()
    }
  });
}

export async function extractAndStoreUserMemories(input: {
  userId: string;
  userInput: string;
  assistantReply: string;
}) {
  try {
    const candidates = await extractMemoryCandidates(input.userInput, input.assistantReply);
    const stored: UserMemory[] = [];

    for (const candidate of candidates) {
      const memory = await upsertUserMemory(input.userId, candidate);
      if (memory) {
        stored.push(memory);
      }
    }

    return stored;
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return [];
    }

    console.error("Memory extraction failed", error);
    return [];
  }
}

export async function extractAndStoreConversationMemories(input: {
  userId: string;
  userInput?: string;
  assistantReply?: string;
  conversationId?: string;
}) {
  if (input.userInput && input.assistantReply) {
    return extractAndStoreUserMemories({
      userId: input.userId,
      userInput: input.userInput,
      assistantReply: input.assistantReply
    });
  }

  if (!input.conversationId) {
    throw new Error("Either conversationId or userInput + assistantReply is required");
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { createdAt: "asc" }
  });

  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.content.trim());

  if (!latestUser || !latestAssistant) {
    throw new Error("Conversation does not have both user and assistant messages");
  }

  return extractAndStoreUserMemories({
    userId: input.userId,
    userInput: latestUser.content,
    assistantReply: latestAssistant.content
  });
}

export function shouldEmitMemoryDebug() {
  return process.env.NODE_ENV !== "production";
}

export function toMemoryDebugPayload(memories: UserMemory[]) {
  return memories.map((memory) => ({
    id: memory.id,
    kind: memory.kind,
    summary: memory.summary,
    salience: memory.salience
  }));
}

async function extractMemoryCandidates(userInput: string, assistantReply: string) {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "Extract long-term user memory candidates from the dialogue. Return strict JSON as an array. Each item must contain: kind, summary, content, salience. Only include stable user traits, preferences, style, favorite actions, constraints, or durable exhibit tendencies. If nothing is durable, return an empty array."
    },
    {
      role: "user",
      content: `User said:\n${userInput}\n\nAssistant replied:\n${assistantReply}\n\nAllowed kinds: profile, preference, interaction_style, favorite_action, constraint, memory_summary. Salience must be 1-100.`
    }
  ];

  const completion = await createChatCompletion(messages);
  const raw = completion.choices[0]?.message?.content ?? "[]";
  const parsed = parseCandidateArray(raw);

  return parsed
    .filter((candidate) => candidate.summary && candidate.content)
    .map((candidate) => ({
      kind: candidate.kind,
      summary: candidate.summary.trim(),
      content: candidate.content.trim(),
      salience: clampSalience(candidate.salience)
    }));
}

async function upsertUserMemory(userId: string, candidate: MemoryCandidate) {
  const existing = await prisma.userMemory.findMany({
    where: {
      userId,
      kind: candidate.kind,
      status: MemoryStatus.active
    },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  const normalizedSummary = normalizeText(candidate.summary);
  const normalizedContent = normalizeText(candidate.content);
  const similar = existing.find((memory) => {
    const summary = normalizeText(memory.summary);
    const content = normalizeText(memory.content);
    return (
      summary === normalizedSummary ||
      content === normalizedContent ||
      summary.includes(normalizedSummary) ||
      normalizedSummary.includes(summary) ||
      content.includes(normalizedContent) ||
      normalizedContent.includes(content)
    );
  });

  if (similar) {
    return prisma.userMemory.update({
      where: { id: similar.id },
      data: {
        summary: candidate.summary,
        content: candidate.content,
        salience: Math.max(similar.salience, candidate.salience),
        source: MemorySource.auto_extracted,
        status: MemoryStatus.active,
        lastUsedAt: new Date()
      }
    });
  }

  return prisma.userMemory.create({
    data: {
      userId,
      kind: candidate.kind,
      summary: candidate.summary,
      content: candidate.content,
      salience: candidate.salience,
      source: MemorySource.auto_extracted,
      status: MemoryStatus.active,
      lastUsedAt: new Date()
    }
  });
}

function buildMemoryContextBlock(stableProfile: UserMemory[], interactionHints: UserMemory[]) {
  if (!stableProfile.length && !interactionHints.length) {
    return "";
  }

  const stableSection = stableProfile.length
    ? stableProfile.map((memory) => `- [${memory.kind}] ${memory.summary}: ${memory.content}`).join("\n")
    : "- none recorded";
  const interactionSection = interactionHints.length
    ? interactionHints.map((memory) => `- [${memory.kind}] ${memory.summary}: ${memory.content}`).join("\n")
    : "- none recorded";

  return `Long-term memory for this user:\nStable profile:\n${stableSection}\n\nInteraction hints:\n${interactionSection}`;
}

function clampSalience(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function parseCandidateArray(raw: string): MemoryCandidate[] {
  const json = extractJsonArray(raw);
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const kind = record.kind;
    const summary = record.summary;
    const content = record.content;
    const salience = record.salience;

    if (
      typeof kind !== "string" ||
      !Object.values(MemoryKind).includes(kind as MemoryKind) ||
      typeof summary !== "string" ||
      typeof content !== "string" ||
      typeof salience !== "number"
    ) {
      return [];
    }

    return [
      {
        kind: kind as MemoryKind,
        summary,
        content,
        salience
      }
    ];
  });
}

function extractJsonArray(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    return trimmed;
  }

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch?.[1]) {
    return codeFenceMatch[1].trim();
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }

  return "[]";
}
