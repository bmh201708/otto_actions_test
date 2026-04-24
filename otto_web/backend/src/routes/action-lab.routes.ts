import { Prisma } from "@prisma/client";
import { Router } from "express";

import { prisma } from "../lib/prisma";
import { VALID_ACTIONS } from "../services/otto-action-specs.service";
import { ottoDevice as device } from "../services/otto-device";

export const actionLabRouter = Router();

const includeSteps = {
  steps: {
    orderBy: { sortOrder: "asc" as const }
  }
};

function toNullableJsonInput(value?: Prisma.JsonValue | null) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeLegacyActionKey(actionKey: string) {
  if (actionKey === "system_wakeup") {
    return "actionHeroPose";
  }

  return actionKey;
}

function normalizeIncomingSteps(
  steps: Array<{ label: string; actionKey: string; offsetMs: number; params?: Prisma.JsonValue | null }>
) {
  return steps
    .map((step, index) => {
      const actionKey = normalizeLegacyActionKey(step.actionKey);
      if (!VALID_ACTIONS.has(actionKey)) {
        return null;
      }

      return {
        label: step.label === "Initialize" && actionKey === "actionHeroPose" ? "Hero Pose" : step.label,
        actionKey,
        offsetMs: Math.max(0, step.offsetMs),
        params: toNullableJsonInput(step.params),
        sortOrder: index
      };
    })
    .filter(Boolean) as Array<{
    label: string;
    actionKey: string;
    offsetMs: number;
    params?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    sortOrder: number;
  }>;
}

function normalizeSequenceForResponse<T extends { steps: Array<{ label: string; actionKey: string; offsetMs: number; params: unknown }> }>(
  sequence: T
) {
  return {
    ...sequence,
    steps: sequence.steps
      .map((step) => {
        const actionKey = normalizeLegacyActionKey(step.actionKey);
        if (!VALID_ACTIONS.has(actionKey)) {
          return null;
        }

        return {
          ...step,
          label: step.label === "Initialize" && actionKey === "actionHeroPose" ? "Hero Pose" : step.label,
          actionKey
        };
      })
      .filter(Boolean)
  };
}

actionLabRouter.get("/sequences", async (_request, response) => {
  const sequences = await prisma.sequence.findMany({
    include: includeSteps,
    orderBy: { updatedAt: "desc" }
  });
  return response.json({ sequences: sequences.map((sequence) => normalizeSequenceForResponse(sequence)) });
});

actionLabRouter.get("/sequences/:id", async (request, response) => {
  const sequence = await prisma.sequence.findUnique({
    where: { id: request.params.id },
    include: includeSteps
  });

  if (!sequence) {
    return response.status(404).json({ error: "Sequence not found" });
  }

  return response.json({ sequence: normalizeSequenceForResponse(sequence) });
});

actionLabRouter.post("/sequences", async (request, response) => {
  const { name, description, steps = [] } = request.body as {
    name?: string;
    description?: string | null;
    steps?: Array<{ label: string; actionKey: string; offsetMs: number; params?: Prisma.JsonValue | null }>;
  };

  if (!name) {
    return response.status(400).json({ error: "Sequence name is required" });
  }

  const sequence = await prisma.sequence.create({
    data: {
      name,
      description,
      steps: {
        create: normalizeIncomingSteps(steps)
      }
    },
    include: includeSteps
  });

  return response.status(201).json({ sequence: normalizeSequenceForResponse(sequence) });
});

actionLabRouter.put("/sequences/:id", async (request, response) => {
  const { name, description, steps = [] } = request.body as {
    name?: string;
    description?: string | null;
    steps?: Array<{ label: string; actionKey: string; offsetMs: number; params?: Prisma.JsonValue | null }>;
  };

  const existing = await prisma.sequence.findUnique({ where: { id: request.params.id } });
  if (!existing) {
    return response.status(404).json({ error: "Sequence not found" });
  }

  await prisma.sequenceStep.deleteMany({ where: { sequenceId: request.params.id } });

  const sequence = await prisma.sequence.update({
    where: { id: request.params.id },
    data: {
      name: name ?? existing.name,
      description: description ?? existing.description,
      steps: {
        create: normalizeIncomingSteps(steps)
      }
    },
    include: includeSteps
  });

  return response.json({ sequence: normalizeSequenceForResponse(sequence) });
});

actionLabRouter.post("/sequences/:id/execute", async (request, response) => {
  const sequence = await prisma.sequence.findUnique({
    where: { id: request.params.id },
    include: includeSteps
  });

  if (!sequence) {
    return response.status(404).json({ error: "Sequence not found" });
  }

  const status = await device.executeSequence(
    normalizeSequenceForResponse(sequence).steps.map((step) => ({
      label: step.label,
      actionKey: step.actionKey,
      offsetMs: step.offsetMs,
      params: step.params as Prisma.JsonValue | null
    }))
  );
  return response.json({ status });
});
