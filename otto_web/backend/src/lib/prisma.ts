import { PrismaClient } from "@prisma/client";

// Avoid caching the client across tsx watch reloads; schema changes can leave
// development with a stale delegate surface such as a missing userMemory model.
export const prisma = new PrismaClient();
