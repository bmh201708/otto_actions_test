"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth(false);
  const [email, setEmail] = useState("admin@otto.local");
  const [password, setPassword] = useState("otto-admin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/control-center");
    }
  }, [router, user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await api.login(email, password);
      router.replace("/control-center");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-surface px-8">
      <div className="absolute inset-0 bg-silk-grid bg-[size:24px_24px] opacity-[0.14]" />
      <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
      <form onSubmit={onSubmit} className="relative z-10 w-full max-w-[620px] rounded-[2.5rem] bg-surface-container-lowest p-14 shadow-talisman">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-primary">Connection Vault</p>
        <h1 className="font-display text-6xl font-black tracking-tight">Enter the Talisman</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-on-surface/65">
          Authenticate as the Otto administrator to access robot controls, oracle streaming, and the action lab.
        </p>

        <div className="mt-14 grid gap-10">
          <label className="grid gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Admin Email</span>
            <input className="input-ink px-0 py-3 text-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Passphrase</span>
            <input
              className="input-ink px-0 py-3 text-xl"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="mt-8 text-sm text-error">{error}</p> : null}

        <div className="mt-12 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.24em] text-on-surface/35">Single-admin v1 access</div>
          <button
            disabled={pending}
            className="pill-button bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-glow hover:scale-[1.03] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            {pending ? "Inscribing…" : "Enter Control Center"}
          </button>
        </div>
      </form>
    </div>
  );
}
