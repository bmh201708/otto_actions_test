import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  JWT_SECRET: z.string().min(1),
  COOKIE_SECRET: z.string().min(1),
  COOKIE_NAME: z.string().default("otto_session"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
  ADMIN_NAME: z.string().min(1),
  LLM_BASE_URL: z.string().optional().or(z.literal("")),
  LLM_API_KEY: z.string().optional().or(z.literal("")),
  LLM_MODEL: z.string().optional().or(z.literal("")),
  ROBOT_MODE: z.string().default("mock"),
  OTTO_DEVICE_BASE_URL: z.string().optional().or(z.literal("")),
  OTTO_DEVICE_TOKEN: z.string().optional().or(z.literal("")),
  OTTO_DEVICE_TIMEOUT_MS: z.coerce.number().default(5000)
});

export const env = envSchema.parse(process.env);

export function getAllowedFrontendOrigins() {
  return env.FRONTEND_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isLlmConfigured() {
  return Boolean(env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL);
}
