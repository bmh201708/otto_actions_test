import { prisma } from "../lib/prisma";
import { MockOttoDeviceService } from "./mock-otto-device.service";

export const ottoDevice = new MockOttoDeviceService(prisma);
