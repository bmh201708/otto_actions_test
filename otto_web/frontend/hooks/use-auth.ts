"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export function useAuth(required = true) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api
      .me()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        if (required && pathname !== "/login") {
          router.replace("/login");
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pathname, required, router]);

  return { user, loading, error, setUser };
}
