import jwt from "jsonwebtoken";

import { env } from "../config/env";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
};

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifySession(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
}
