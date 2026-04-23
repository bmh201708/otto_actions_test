import { VoiceSessionStatus } from "@prisma/client";
import { Router, raw } from "express";

import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { transcribeWithBaiduSpeech } from "../services/baidu-speech.service";
import { runPersistedAssistantTurn } from "../services/chat-orchestrator.service";
import { ottoDevice } from "../services/otto-device";

export const voiceRouter = Router();

voiceRouter.post("/listen/start", requireAuth, async (request, response) => {
  try {
    if (!env.BACKEND_DEVICE_BASE_URL) {
      return response.status(400).json({ error: "BACKEND_DEVICE_BASE_URL is not configured" });
    }

    const voiceSession = await prisma.voiceSession.create({
      data: {
        userId: request.user!.sub,
        robotId: env.OTTO_DEVICE_BASE_URL || "mock-device",
        status: VoiceSessionStatus.recording
      }
    });

    const uploadUrl = `${env.BACKEND_DEVICE_BASE_URL.replace(/\/$/, "")}/api/voice/uploads?sessionId=${voiceSession.id}`;
    const deviceStatus = await ottoDevice.startListening(voiceSession.id, uploadUrl);

    return response.status(201).json({
      voiceSession: await prisma.voiceSession.update({
        where: { id: voiceSession.id },
        data: { status: VoiceSessionStatus.recording }
      }),
      deviceStatus
    });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to start listening" });
  }
});

voiceRouter.post("/listen/stop", requireAuth, async (request, response) => {
  try {
    const latestSession = await prisma.voiceSession.findFirst({
      where: {
        userId: request.user!.sub,
        status: {
          in: [VoiceSessionStatus.recording, VoiceSessionStatus.uploaded, VoiceSessionStatus.transcribing]
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    if (!latestSession) {
      return response.status(404).json({ error: "No active voice session" });
    }

    const deviceStatus = await ottoDevice.stopListening();
    let voiceSession = await prisma.voiceSession.update({
      where: { id: latestSession.id },
      data: {
        status: VoiceSessionStatus.uploaded
      }
    });

    if (env.ROBOT_MODE === "mock") {
      const prepared = await prepareVoiceSessionFromTranscript(voiceSession.id, "请热情地欢迎现场观众。");
      if (prepared.status !== VoiceSessionStatus.failed) {
        await finalizeVoiceSessionResponse(voiceSession.id, request.user!.sub, prepared.transcript ?? "", voiceSession.conversationId);
        voiceSession = await prisma.voiceSession.findUniqueOrThrow({
          where: { id: voiceSession.id }
        });
      } else {
        voiceSession = prepared;
      }
    }

    return response.json({ voiceSession, deviceStatus });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to stop listening" });
  }
});

voiceRouter.get("/status", requireAuth, async (request, response) => {
  try {
    const [voiceSession, deviceStatus] = await Promise.all([
      prisma.voiceSession.findFirst({
        where: { userId: request.user!.sub },
        orderBy: { updatedAt: "desc" }
      }),
      ottoDevice.getVoiceStatus()
    ]);

    return response.json({ voiceSession, deviceStatus });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Unable to fetch voice status" });
  }
});

voiceRouter.post(
  "/uploads",
  raw({
    type: ["audio/wav", "audio/x-wav", "audio/pcm", "application/octet-stream"],
    limit: "3mb"
  }),
  async (request, response) => {
    const token = request.header("X-Otto-Token");
    const sessionId = typeof request.query.sessionId === "string" ? request.query.sessionId : "";

    if (!env.OTTO_DEVICE_TOKEN || token !== env.OTTO_DEVICE_TOKEN) {
      return response.status(401).json({ error: "Unauthorized device upload" });
    }

    if (!sessionId) {
      return response.status(400).json({ error: "sessionId is required" });
    }

    const audioBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (!audioBuffer.length) {
      return response.status(400).json({ error: "Audio payload is required" });
    }

    const voiceSession = await prisma.voiceSession.findUnique({
      where: { id: sessionId }
    });

    if (!voiceSession) {
      return response.status(404).json({ error: "Voice session not found" });
    }

    try {
      const updated = await prisma.voiceSession.update({
        where: { id: sessionId },
        data: { status: VoiceSessionStatus.transcribing }
      });

      const format = request.header("content-type")?.includes("pcm") ? "pcm" : "wav";
      const sampleRate = Number(request.header("X-Audio-Sample-Rate") ?? 8000) || 8000;
      const transcript = await transcribeWithBaiduSpeech(audioBuffer, format, sampleRate);
      const prepared = await prepareVoiceSessionFromTranscript(updated.id, transcript);

      if (prepared.status === VoiceSessionStatus.failed) {
        return response.status(422).json({
          ok: false,
          transcript: prepared.transcript,
          error: prepared.error
        });
      }

      setTimeout(() => {
        void finalizeVoiceSessionResponse(updated.id, updated.userId, prepared.transcript ?? "", updated.conversationId);
      }, 750);

      return response.status(202).json({
        ok: true,
        transcript: prepared.transcript,
        status: prepared.status
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice processing failed";
      await prisma.voiceSession.update({
        where: { id: sessionId },
        data: {
          status: VoiceSessionStatus.failed,
          error: message
        }
      });
      return response.status(502).json({ error: message });
    }
  }
);

async function prepareVoiceSessionFromTranscript(sessionId: string, transcript: string) {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) {
    return prisma.voiceSession.update({
      where: { id: sessionId },
      data: {
        status: VoiceSessionStatus.failed,
        transcript: "",
        error: "No speech recognized"
      }
    });
  }

  await prisma.voiceSession.update({
    where: { id: sessionId },
    data: {
      status: VoiceSessionStatus.responding,
      transcript: normalizedTranscript,
      error: null
    }
  });

  return prisma.voiceSession.findUniqueOrThrow({
    where: { id: sessionId }
  });
}

async function finalizeVoiceSessionResponse(sessionId: string, userId: string, transcript: string, conversationId?: string | null) {
  try {
    const result = await runPersistedAssistantTurn({
      userId,
      content: transcript,
      conversationId,
      assistantModel: env.LLM_MODEL ?? null
    });

    await prisma.voiceSession.update({
      where: { id: sessionId },
      data: {
        status: VoiceSessionStatus.completed,
        transcript,
        assistantReply: result.assistantReply,
        conversationId: result.conversation.id,
        error: null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice response generation failed";
    await prisma.voiceSession.update({
      where: { id: sessionId },
      data: {
        status: VoiceSessionStatus.failed,
        error: message
      }
    });
  }
}
