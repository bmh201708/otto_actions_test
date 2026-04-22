import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __ottoPrisma: PrismaClient | undefined;
}

export const prisma = global.__ottoPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__ottoPrisma = prisma;
}
