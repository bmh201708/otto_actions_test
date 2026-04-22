import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { verifySession } from "../lib/jwt";

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const signedCookies = request.signedCookies as Record<string, string | undefined>;
  const token = signedCookies[env.COOKIE_NAME];

  if (!token) {
    return response.status(401).json({ error: "Authentication required" });
  }

  try {
    request.user = verifySession(token);
    return next();
  } catch {
    return response.status(401).json({ error: "Invalid session" });
  }
}
