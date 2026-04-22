"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { RobotStatus } from "@/lib/types";

export function useRobotStatus(pollMs = 3000) {
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getRobotStatus();
      setStatus(data.status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  return { status, setStatus, loading, error, refresh };
}
