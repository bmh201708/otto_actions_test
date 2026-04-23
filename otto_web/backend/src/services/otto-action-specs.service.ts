type ParamType = "integer" | "number" | "boolean" | "enum";

type Primitive = string | number | boolean;

type ActionParamSpec = {
  type: ParamType;
  description: string;
  default: Primitive;
  minimum?: number;
  maximum?: number;
  enumValues?: string[];
  llmTunable?: boolean;
};

type ActionSpec = {
  actionKey: string;
  label: string;
  description: string;
  params: Record<string, ActionParamSpec>;
  buildDynamicDefaults: () => Record<string, Primitive>;
};

type ActionParams = Record<string, Primitive>;

const randomInt = (minimum: number, maximum: number) => Math.round(minimum + Math.random() * (maximum - minimum));
const randomNumber = (minimum: number, maximum: number, digits = 1) =>
  Number((minimum + Math.random() * (maximum - minimum)).toFixed(digits));
const pick = <T>(values: T[]) => values[Math.floor(Math.random() * values.length)];

export const ACTION_SPECS: ActionSpec[] = [
  {
    actionKey: "actionWaveGoodbye",
    label: "Wave Goodbye",
    description: "A one-arm farewell wave with variable amplitude and pace.",
    params: {
      amplitude: {
        type: "integer",
        description: "Arm swing amplitude in degrees.",
        default: 16,
        minimum: 10,
        maximum: 24
      },
      tempo: {
        type: "integer",
        description: "Milliseconds for one wave cycle.",
        default: 1000,
        minimum: 800,
        maximum: 1300
      },
      repetitions: {
        type: "integer",
        description: "How many wave cycles to perform.",
        default: 3,
        minimum: 2,
        maximum: 5
      },
      armBias: {
        type: "integer",
        description: "Raised resting angle bias for the waving arm.",
        default: 45,
        minimum: 30,
        maximum: 60
      },
      style: {
        type: "enum",
        description: "Overall waving style.",
        default: "classic",
        enumValues: ["gentle", "classic", "energetic"]
      }
    },
    buildDynamicDefaults: () => ({
      amplitude: randomInt(12, 22),
      tempo: randomInt(850, 1200),
      repetitions: randomInt(2, 4),
      armBias: randomInt(38, 55),
      style: pick(["gentle", "classic", "energetic"])
    })
  },
  {
    actionKey: "actionDoubleGreet",
    label: "Double Greet",
    description: "A two-arm greeting gesture with tunable amplitude and repetition count.",
    params: {
      amplitude: {
        type: "integer",
        description: "Greeting swing amplitude in degrees.",
        default: 15,
        minimum: 8,
        maximum: 22
      },
      tempo: {
        type: "integer",
        description: "Milliseconds for one greet cycle.",
        default: 1200,
        minimum: 900,
        maximum: 1500
      },
      repetitions: {
        type: "integer",
        description: "How many greet cycles to perform.",
        default: 3,
        minimum: 2,
        maximum: 5
      },
      armBias: {
        type: "integer",
        description: "Offset from neutral arm position.",
        default: 15,
        minimum: 8,
        maximum: 25
      }
    },
    buildDynamicDefaults: () => ({
      amplitude: randomInt(10, 20),
      tempo: randomInt(950, 1400),
      repetitions: randomInt(2, 4),
      armBias: randomInt(10, 20)
    })
  },
  {
    actionKey: "actionCheer",
    label: "Cheer",
    description: "A fast celebratory arm cheer with adjustable energy.",
    params: {
      amplitude: {
        type: "integer",
        description: "Cheer amplitude in degrees.",
        default: 8,
        minimum: 5,
        maximum: 14
      },
      tempo: {
        type: "integer",
        description: "Milliseconds for one cheer cycle.",
        default: 400,
        minimum: 260,
        maximum: 650
      },
      repetitions: {
        type: "integer",
        description: "How many cycles to cheer.",
        default: 8,
        minimum: 4,
        maximum: 12
      },
      style: {
        type: "enum",
        description: "Cheer intensity preset.",
        default: "bright",
        enumValues: ["bright", "pumped", "victory"]
      }
    },
    buildDynamicDefaults: () => ({
      amplitude: randomInt(6, 12),
      tempo: randomInt(320, 560),
      repetitions: randomInt(5, 10),
      style: pick(["bright", "pumped", "victory"])
    })
  },
  {
    actionKey: "actionWalk",
    label: "Walk",
    description: "A walking motion with tunable cadence and step count.",
    params: {
      steps: {
        type: "integer",
        description: "Number of steps to walk.",
        default: 4,
        minimum: 2,
        maximum: 8
      },
      period: {
        type: "integer",
        description: "Milliseconds per gait period.",
        default: 1500,
        minimum: 1000,
        maximum: 2200
      },
      isForward: {
        type: "boolean",
        description: "Whether Otto walks forward.",
        default: true
      }
    },
    buildDynamicDefaults: () => ({
      steps: randomInt(3, 6),
      period: randomInt(1200, 1900),
      isForward: Math.random() > 0.15
    })
  },
  {
    actionKey: "actionTwistHip",
    label: "Twist Hip",
    description: "A hip twist routine with adjustable cadence and intensity.",
    params: {
      cycles: {
        type: "integer",
        description: "Number of twist cycles.",
        default: 4,
        minimum: 2,
        maximum: 7
      },
      moveTime: {
        type: "integer",
        description: "Milliseconds spent moving into each pose.",
        default: 250,
        minimum: 150,
        maximum: 420
      },
      pauseTime: {
        type: "integer",
        description: "Milliseconds to hold each pose.",
        default: 150,
        minimum: 80,
        maximum: 260
      },
      style: {
        type: "enum",
        description: "Twist personality preset.",
        default: "classic",
        enumValues: ["tight", "classic", "dramatic"]
      }
    },
    buildDynamicDefaults: () => ({
      cycles: randomInt(3, 5),
      moveTime: randomInt(180, 340),
      pauseTime: randomInt(100, 220),
      style: pick(["tight", "classic", "dramatic"])
    })
  },
  {
    actionKey: "actionFullBodyWave",
    label: "Full Body Wave",
    description: "A coordinated body wave with adjustable cycle count.",
    params: {
      cycles: {
        type: "integer",
        description: "Number of wave cycles.",
        default: 3,
        minimum: 1,
        maximum: 5
      },
      tempo: {
        type: "integer",
        description: "Milliseconds for one body-wave cycle.",
        default: 2000,
        minimum: 1400,
        maximum: 2600
      }
    },
    buildDynamicDefaults: () => ({
      cycles: randomInt(2, 4),
      tempo: randomInt(1600, 2400)
    })
  },
  {
    actionKey: "actionSleep",
    label: "Sleep",
    description: "A calm idle sleep routine.",
    params: {
      duration: {
        type: "integer",
        description: "Sleep duration in milliseconds.",
        default: 12000,
        minimum: 5000,
        maximum: 18000
      }
    },
    buildDynamicDefaults: () => ({
      duration: randomInt(7000, 15000)
    })
  },
  {
    actionKey: "actionHeroPose",
    label: "Hero Pose",
    description: "A brief hero landing pose.",
    params: {
      holdTime: {
        type: "integer",
        description: "How long to hold the hero pose in milliseconds.",
        default: 4000,
        minimum: 1500,
        maximum: 7000
      }
    },
    buildDynamicDefaults: () => ({
      holdTime: randomInt(2500, 5500)
    })
  }
];

const ACTION_SPEC_MAP = new Map(ACTION_SPECS.map((spec) => [spec.actionKey, spec]));

export const VALID_ACTIONS = new Set(ACTION_SPECS.map((spec) => spec.actionKey));

export type NormalizedActionResult = {
  actionKey: string;
  params: ActionParams;
};

export function getActionSpec(actionKey: string) {
  return ACTION_SPEC_MAP.get(actionKey);
}

export function listActionSpecs() {
  return ACTION_SPECS.map((spec) => ({
    actionKey: spec.actionKey,
    label: spec.label,
    description: spec.description,
    params: spec.params
  }));
}

export function normalizeActionRequest(actionKey: string, input?: unknown): NormalizedActionResult {
  const spec = getActionSpec(actionKey);
  if (!spec) {
    throw new Error("Unsupported action key");
  }

  if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) {
    throw new Error("Action params must be an object");
  }

  const provided = (input ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(provided).filter((key) => !(key in spec.params));
  if (unknownKeys.length) {
    throw new Error(`Unsupported params: ${unknownKeys.join(", ")}`);
  }

  const generatedDefaults = spec.buildDynamicDefaults();
  const normalized: ActionParams = {};

  for (const [key, paramSpec] of Object.entries(spec.params)) {
    normalized[key] = normalizeSingleParam(paramSpec, provided[key], generatedDefaults[key] ?? paramSpec.default);
  }

  return {
    actionKey,
    params: normalized
  };
}

export function buildActionPlanningGuide() {
  return ACTION_SPECS.map((spec) => {
    const params = Object.entries(spec.params)
      .map(([key, param]) => {
        if (param.type === "enum") {
          return `${key}: enum(${param.enumValues?.join("/")})`;
        }

        if (param.type === "boolean") {
          return `${key}: boolean`;
        }

        return `${key}: ${param.type} ${param.minimum ?? ""}-${param.maximum ?? ""}`.trim();
      })
      .join("; ");

    return `${spec.actionKey}: ${spec.description} Params => ${params}`;
  }).join("\n");
}

function normalizeSingleParam(spec: ActionParamSpec, value: unknown, fallback: Primitive): Primitive {
  const finalValue = value === undefined ? fallback : value;

  switch (spec.type) {
    case "boolean": {
      if (typeof finalValue !== "boolean") {
        throw new Error(`Param must be boolean: ${spec.description}`);
      }

      return finalValue;
    }
    case "enum": {
      if (typeof finalValue !== "string" || !spec.enumValues?.includes(finalValue)) {
        throw new Error(`Param must be one of: ${spec.enumValues?.join(", ")}`);
      }

      return finalValue;
    }
    case "integer":
    case "number": {
      if (typeof finalValue !== "number" || Number.isNaN(finalValue)) {
        throw new Error(`Param must be numeric: ${spec.description}`);
      }

      const bounded = clampNumber(finalValue, spec.minimum, spec.maximum);
      return spec.type === "integer" ? Math.round(bounded) : randomNumber(bounded, bounded, 2);
    }
  }
}

function clampNumber(value: number, minimum?: number, maximum?: number) {
  let next = value;
  if (minimum !== undefined) next = Math.max(minimum, next);
  if (maximum !== undefined) next = Math.min(maximum, next);
  return next;
}
