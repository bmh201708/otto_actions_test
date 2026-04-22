import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
  const client = createClient();

  return client.chat.completions.create({
    model: env.LLM_MODEL!,
    temperature: 0.85,
    messages
  });
}
