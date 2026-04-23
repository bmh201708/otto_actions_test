import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool
} from "openai/resources/chat/completions";

import { env, isLlmConfigured } from "../config/env";

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("LLM provider is not configured");
  }
}

function createClient() {
  if (!isLlmConfigured()) {
    throw new LlmNotConfiguredError();
  }

  return new OpenAI({
    apiKey: env.LLM_API_KEY,
    baseURL: env.LLM_BASE_URL
  });
}

export async function createChatStream(messages: ChatCompletionMessageParam[]) {
  const client = createClient();

  return client.chat.completions.create({
    model: env.LLM_MODEL!,
    stream: true,
    temperature: 0.85,
    messages
  });
}

export async function createChatCompletion(messages: ChatCompletionMessageParam[]) {
  return createChatCompletionWithOptions({
    messages
  });
}

export async function createChatCompletionWithOptions(
  options: Pick<ChatCompletionCreateParamsNonStreaming, "messages" | "tools" | "tool_choice" | "parallel_tool_calls">
) {
  const client = createClient();

  return client.chat.completions.create({
    model: env.LLM_MODEL!,
    temperature: 0.85,
    ...options
  });
}

export async function createToolPlanningCompletion(messages: ChatCompletionMessageParam[], tools: ChatCompletionTool[]) {
  return createChatCompletionWithOptions({
    messages,
    tools,
    tool_choice: "auto",
    parallel_tool_calls: true
  });
}
