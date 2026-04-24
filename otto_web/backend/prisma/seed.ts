import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@otto.local";
  const password = process.env.ADMIN_PASSWORD ?? "otto-admin";
  const name = process.env.ADMIN_NAME ?? "Otto Administrator";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash }
  });

  const robotStatus = await prisma.robotStatus.findFirst();

  if (!robotStatus) {
    await prisma.robotStatus.create({
      data: {
        isOnline: true,
        isBusy: false,
        batteryPercent: 84,
        signalStrength: "Stable",
        distanceCm: 8.6,
        currentAction: "idle",
        coreTempC: 42,
        memoryPercent: 12,
        firmwareVersion: "V.4.2.8"
      }
    });
  }

  const sequenceCount = await prisma.sequence.count();
  if (sequenceCount === 0) {
    await prisma.sequence.create({
      data: {
        name: "Morning Awakening Ritual",
        description: "Signature wake and greet sequence",
        steps: {
          create: [
            { label: "Hero Pose", actionKey: "actionHeroPose", offsetMs: 0, sortOrder: 0 },
            { label: "Bow / Greet", actionKey: "actionDoubleGreet", offsetMs: 1500, sortOrder: 1 },
            { label: "Wave Goodbye", actionKey: "actionWaveGoodbye", offsetMs: 3200, sortOrder: 2 }
          ]
        }
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
