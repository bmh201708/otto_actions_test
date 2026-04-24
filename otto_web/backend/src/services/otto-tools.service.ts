import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam
} from "openai/resources/chat/completions";

import {
  buildActionPlanningGuide,
  listActionSpecs,
  normalizeActionRequest,
  VALID_ACTIONS
} from "./otto-action-specs.service";
import { ottoDevice } from "./otto-device";

type ToolExecutionEvent =
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

type ToolExecutionOutput = {
  events: ToolExecutionEvent[];
  toolMessages: ChatCompletionToolMessageParam[];
};

const actionSpecs = listActionSpecs();
const sharedActionParamSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    amplitude: { type: "number", description: "Motion amplitude in degrees when supported." },
    tempo: { type: "integer", description: "Timing for a single motion cycle in milliseconds." },
    repetitions: { type: "integer", description: "How many times the gesture repeats." },
    armBias: { type: "integer", description: "Arm resting offset when supported." },
    style: {
      type: "string",
      enum: ["gentle", "classic", "energetic", "bright", "pumped", "victory", "tight", "dramatic"],
      description: "High-level style preset."
    },
    steps: { type: "integer", description: "Number of walking steps." },
    period: { type: "integer", description: "Walking period in milliseconds." },
    isForward: { type: "boolean", description: "Whether the walk moves forward." },
    cycles: { type: "integer", description: "Number of motion cycles." },
    moveTime: { type: "integer", description: "Milliseconds spent transitioning into a pose." },
    pauseTime: { type: "integer", description: "Milliseconds spent holding a pose." },
    duration: { type: "integer", description: "Duration in milliseconds." },
    holdTime: { type: "integer", description: "How long to hold a pose." },
    depth: { type: "integer", description: "Depth of a bowing motion in degrees." },
    armSpread: { type: "integer", description: "How wide the arms open from neutral." },
    sway: { type: "integer", description: "Amount of side sway during a gesture." },
    lift: { type: "integer", description: "How high a leg lifts during marching." },
    armSwing: { type: "integer", description: "Arm swing size for marching motions." },
    lean: { type: "integer", description: "How far Otto leans to either side." }
  }
} as const;

export const ottoTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "otto_execute_action",
      description:
        "Execute a predefined Otto robot action with safe, variable parameters. Use only when movement would improve the interaction.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actionKey: {
            type: "string",
            enum: actionSpecs.map((spec) => spec.actionKey),
            description: "The predefined Otto motion to execute."
          },
          params: {
            ...sharedActionParamSchema,
            description: "Action parameters. Only include parameters supported by the selected action."
          },
          reason: {
            type: "string",
            description: "Why this action helps the current interaction."
          }
        },
        required: ["actionKey"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "otto_move",
      description: "Move Otto in a simple direction.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          direction: {
            type: "string",
            enum: ["forward", "backward", "left", "right"],
            description: "The movement direction."
          }
        },
        required: ["direction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "otto_speak",
      description: "Ask Otto to speak a short line aloud.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: {
            type: "string",
            description: "The short phrase for Otto to speak."
          }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "otto_calibrate",
      description: "Calibrate Otto before a more precise interaction.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: {
            type: "string",
            enum: ["full"],
            description: "Calibration mode."
          }
        }
      }
    }
  }
];

export function buildToolPlanningMessages(messages: ChatCompletionMessageParam[], memoryContext = ""): ChatCompletionMessageParam[] {
  const systemParts = [
    "You are Otto's interaction orchestrator.",
    "Call Otto tools only when physical motion or speech will clearly improve the interaction.",
    "Use sparse, purposeful actions.",
    "When calling otto_execute_action, keep params within safe ranges and vary them naturally between turns.",
    `Available actions and safe parameter ranges:\n${buildActionPlanningGuide()}`
  ];

  if (memoryContext) {
    systemParts.push(memoryContext);
  }

  return [
    {
      role: "system",
      content: systemParts.join("\n\n")
    },
    ...messages
  ];
}

export function buildFinalResponseMessages(messages: ChatCompletionMessageParam[], memoryContext = ""): ChatCompletionMessageParam[] {
  const systemParts = [
    "You are Otto's oracle-grade operator copilot.",
    "After any tool calls, give the user a concise, grounded reply.",
    "Mention robot actions naturally when they happened, but do not expose raw tool schemas or JSON."
  ];

  if (memoryContext) {
    systemParts.push(memoryContext);
  }

  return [
    {
      role: "system",
      content: systemParts.join("\n\n")
    },
    ...messages
  ];
}

export function toAssistantToolCallMessage(toolCalls: ChatCompletionMessageToolCall[]): ChatCompletionAssistantMessageParam {
  return {
    role: "assistant",
    content: null,
    tool_calls: toolCalls
  };
}

export async function executeToolCalls(toolCalls: ChatCompletionMessageToolCall[]): Promise<ToolExecutionOutput> {
  const events: ToolExecutionEvent[] = [];
  const toolMessages: ChatCompletionToolMessageParam[] = [];

  for (const toolCall of toolCalls) {
    const name = toolCall.function.name;
    const parsedArgs = parseToolArguments(toolCall.function.arguments);
    events.push({
      type: "tool_call",
      name,
      arguments: parsedArgs
    });

    const result = await runTool(name, parsedArgs);
    events.push({
      type: "tool_result",
      name,
      result
    });

    toolMessages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result)
    });
  }

  return {
    events,
    toolMessages
  };
}

async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "otto_execute_action": {
      const actionKey = typeof args.actionKey === "string" ? args.actionKey : "";
      if (!VALID_ACTIONS.has(actionKey)) {
        return {
          ok: false,
          error: "Unsupported action key"
        };
      }

      try {
        const normalized = normalizeActionRequest(actionKey, args.params);
        const status = await ottoDevice.executeAction(
          actionKey,
          normalized.params as unknown as import("@prisma/client").Prisma.JsonValue
        );

        return {
          ok: true,
          actionKey,
          reason: typeof args.reason === "string" ? args.reason : null,
          normalizedParams: normalized.params,
          status
        };
      } catch (error) {
        return {
          ok: false,
          actionKey,
          error: error instanceof Error ? error.message : "Action execution failed"
        };
      }
    }
    case "otto_move": {
      const direction = typeof args.direction === "string" ? args.direction : "forward";
      const status = await ottoDevice.move(direction);
      return {
        ok: true,
        direction,
        status
      };
    }
    case "otto_speak": {
      const text = typeof args.text === "string" ? args.text.trim() : "";
      const status = await ottoDevice.speak(text);
      return {
        ok: true,
        text,
        status
      };
    }
    case "otto_calibrate": {
      const status = await ottoDevice.calibrate();
      return {
        ok: true,
        mode: "full",
        status
      };
    }
    default:
      return {
        ok: false,
        error: `Unsupported tool: ${name}`
      };
  }
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}
