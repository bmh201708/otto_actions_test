import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam
} from "openai/resources/chat/completions";

import { VALID_ACTIONS } from "./mock-otto-device.service";
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

const actionKeys = Array.from(VALID_ACTIONS);

export const ottoTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "otto_execute_action",
      description: "Execute a predefined Otto robot action when movement would improve the interaction.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          actionKey: {
            type: "string",
            enum: actionKeys,
            description: "The predefined Otto motion to execute."
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

export function buildToolPlanningMessages(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content:
        "You are Otto's interaction orchestrator. Reply normally when no physical action is needed. If a gesture, movement, calibration, or spoken line would improve the experience, call the appropriate Otto tool first. Keep tool use sparse and purposeful."
    },
    ...messages
  ];
}

export function buildFinalResponseMessages(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content:
        "You are Otto's oracle-grade operator copilot. After any tool calls, give the user a concise, grounded reply. Mention robot actions naturally when they happened, but do not expose raw tool schemas or JSON."
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
      const status = await ottoDevice.executeAction(actionKey, args as unknown as import("@prisma/client").Prisma.JsonValue);
      return {
        ok: true,
        action: actionKey,
        status
      };
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
      const text = typeof args.text === "string" ? args.text : "";
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
