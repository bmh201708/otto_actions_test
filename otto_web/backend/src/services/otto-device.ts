import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { Esp32HttpOttoDeviceService } from "./esp32-http-otto-device.service";
import { MockOttoDeviceService } from "./mock-otto-device.service";

export const ottoDevice =
  env.ROBOT_MODE === "esp32_http" ? new Esp32HttpOttoDeviceService(prisma) : new MockOttoDeviceService(prisma);
