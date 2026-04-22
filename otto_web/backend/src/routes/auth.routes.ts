import { Router } from "express";
import bcrypt from "bcryptjs";

import { env } from "../config/env";
import { signSession } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
  const { email, password } = request.body as { email?: string; password?: string };

  if (!email || !password) {
    return response.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return response.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return response.status(401).json({ error: "Invalid credentials" });
  }

  const token = signSession({ sub: user.id, email: user.email, name: user.name });

  response.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

authRouter.post("/logout", async (_request, response) => {
  response.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: false
  });

  return response.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user!.sub },
    select: { id: true, email: true, name: true }
  });

  return response.json({ user });
});
