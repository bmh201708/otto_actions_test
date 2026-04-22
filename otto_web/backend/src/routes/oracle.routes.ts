import { Router } from "express";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { prisma } from "../lib/prisma";
import { createChatCompletion, createChatStream, LlmNotConfiguredError } from "../services/openai.service";
import { openSse, sendSse } from "../services/sse";

export const oracleRouter = Router();

oracleRouter.post("/draw", async (request, response) => {
  const { prompt } = request.body as { prompt?: string };
  const finalPrompt = prompt?.trim();

  if (!finalPrompt) {
    return response.status(400).json({ error: "Prompt is required" });
  }

  const signNumber = Math.floor(Math.random() * 64) + 1;

  let title = "Great Fortune";
  let quote = "\"The dragon leaps from the deep abyss, ascending to the sky.\"";
  let interpretation = "";
  let recommendedActions = ["Awaiting streamed insight."];
  let elementalAffinity = "Wood / Fire";
  let status: "pending" | "completed" | "failed" = "pending";
  let error: string | null = null;

  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are the Digital Talisman oracle for an Otto robot. Return JSON with keys title, quote, interpretation, recommendedActions (array of 2 short strings), elementalAffinity."
      },
      {
        role: "user",
        content: `Create an oracle reading for sign ${signNumber} based on this prompt: ${finalPrompt}`
      }
    ];

    const completion = await createChatCompletion(messages);
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    title = parsed.title ?? title;
    quote = parsed.quote ?? quote;
    interpretation = parsed.interpretation ?? interpretation;
    recommendedActions = Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : recommendedActions;
    elementalAffinity = parsed.elementalAffinity ?? elementalAffinity;
    status = "completed";
  } catch (llmError) {
    if (llmError instanceof LlmNotConfiguredError) {
      error = llmError.message;
    } else {
      error = llmError instanceof Error ? llmError.message : "Oracle generation failed";
    }
  }

  const reading = await prisma.oracleReading.create({
    data: {
      prompt: finalPrompt,
      signNumber,
      title,
      quote,
      interpretation,
      recommendedActions,
      elementalAffinity,
      status,
      error,
      userId: request.user?.sub
    }
  });

  return response.status(201).json({
    reading: {
      ...reading,
      recommendedActions: Array.isArray(reading.recommendedActions) ? reading.recommendedActions : []
    }
  });
});

oracleRouter.get("/history", async (_request, response) => {
  const readings = await prisma.oracleReading.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return response.json({
    readings: readings.map((reading) => ({
      ...reading,
      recommendedActions: Array.isArray(reading.recommendedActions) ? reading.recommendedActions : []
    }))
  });
});

oracleRouter.get("/stream/:readingId", async (request, response) => {
  const reading = await prisma.oracleReading.findUnique({ where: { id: request.params.readingId } });

  if (!reading) {
    return response.status(404).json({ error: "Reading not found" });
  }

  if (reading.status === "completed" && reading.interpretation) {
    openSse(response);
    sendSse(response, "oracle.delta", { chunk: reading.interpretation });
    sendSse(response, "oracle.done", {
      reading: {
        ...reading,
        recommendedActions: Array.isArray(reading.recommendedActions) ? reading.recommendedActions : []
      }
    });
    return response.end();
  }

  openSse(response);

  try {
    const stream = await createChatStream([
      {
        role: "system",
        content:
          "You are the Digital Talisman oracle for an Otto robot. Write one elegant interpretation paragraph followed by two actionable bullet concepts internally."
      },
      {
        role: "user",
        content: `Oracle prompt: ${reading.prompt}\nSign number: ${reading.signNumber}\nTitle: ${reading.title}\nQuote: ${reading.quote}\nElemental affinity: ${reading.elementalAffinity}`
      }
    ]);

    let interpretation = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (!delta) continue;
      interpretation += delta;
      sendSse(response, "oracle.delta", { chunk: delta });
    }

    const updated = await prisma.oracleReading.update({
      where: { id: reading.id },
      data: {
        interpretation,
        status: "completed",
        recommendedActions: [
          "Promotion: Actively seek advancement. The winds are favorable.",
          "Renewal: Discard outdated methods and embrace new technologies."
        ]
      }
    });

    sendSse(response, "oracle.done", {
      reading: {
        ...updated,
        recommendedActions: Array.isArray(updated.recommendedActions) ? updated.recommendedActions : []
      }
    });
    return response.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oracle stream failed";
    await prisma.oracleReading.update({
      where: { id: reading.id },
      data: { status: "failed", error: message }
    });
    sendSse(response, "oracle.error", { error: message });
    return response.end();
  }
});
