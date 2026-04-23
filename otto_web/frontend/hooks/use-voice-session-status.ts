"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { DeviceVoiceStatus, VoiceSession } from "@/lib/types";

export function useVoiceSessionStatus(pollMs = 2000) {
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceVoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getVoiceStatus();
      setVoiceSession(data.voiceSession);
      setDeviceStatus(data.deviceStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch voice session");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  return { voiceSession, deviceStatus, error, refresh, setVoiceSession, setDeviceStatus };
}
