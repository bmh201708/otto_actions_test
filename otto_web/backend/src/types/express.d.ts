import type { SessionPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export {};
