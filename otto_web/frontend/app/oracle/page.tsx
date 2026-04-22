"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { OracleResultCard } from "@/components/oracle-result-card";
import { api } from "@/lib/api";
import type { Conversation, Message, OracleReading } from "@/lib/types";

export default function OraclePage() {
  const [prompt, setPrompt] = useState("Will Otto bring auspicious momentum to tomorrow's demo?");
  const [reading, setReading] = useState<OracleReading | null>(null);
  const [streamedInterpretation, setStreamedInterpretation] = useState("");
  const [history, setHistory] = useState<OracleReading[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("How should Otto greet visitors at the exhibition?");

  useEffect(() => {
    void api.getOracleHistory().then((data) => setHistory(data.readings));
    void api.listConversations().then((data) => setConversations(data.conversations));
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    void api.listMessages(activeConversationId).then((data) => setMessages(data.messages));
  }, [activeConversationId]);

  async function handleDraw(event: FormEvent) {
    event.preventDefault();
    setStreamedInterpretation("");
    const data = await api.drawOracle(prompt);
    setReading(data.reading);
    setHistory((current) => [data.reading, ...current.filter((item) => item.id !== data.reading.id)]);

    const stream = new EventSource(api.oracleStreamUrl(data.reading.id), { withCredentials: true });
    stream.addEventListener("oracle.delta", (evt) => {
      const payload = JSON.parse((evt as MessageEvent).data) as { chunk: string };
      setStreamedInterpretation((current) => current + payload.chunk);
    });
    stream.addEventListener("oracle.done", (evt) => {
      const payload = JSON.parse((evt as MessageEvent).data) as { reading: OracleReading };
      setReading(payload.reading);
      setHistory((current) => [payload.reading, ...current.filter((item) => item.id !== payload.reading.id)]);
      setStreamedInterpretation(payload.reading.interpretation);
      stream.close();
    });
    stream.addEventListener("oracle.error", () => {
      stream.close();
    });
  }

  async function handleChat(event: FormEvent) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content) return;

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, optimistic]);
    setChatInput("");

    const data = await api.createMessage(activeConversationId, content);
    setActiveConversationId(data.conversationId);

    const stream = new EventSource(api.chatStreamUrl(data.conversationId, data.assistantMessageId), { withCredentials: true });
    let assistantContent = "";
    const assistant: Message = {
      id: data.assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, assistant]);

    stream.addEventListener("chat.delta", (evt) => {
      const payload = JSON.parse((evt as MessageEvent).data) as { chunk: string };
      assistantContent += payload.chunk;
      setMessages((current) =>
        current.map((item) => (item.id === data.assistantMessageId ? { ...item, content: assistantContent } : item))
      );
    });
    stream.addEventListener("chat.done", async () => {
      stream.close();
      const next = await api.listMessages(data.conversationId);
      setMessages(next.messages);
      const convoList = await api.listConversations();
      setConversations(convoList.conversations);
    });
    stream.addEventListener("chat.error", () => {
      stream.close();
    });
  }

  const recentReading = useMemo(() => reading ?? history[0] ?? null, [history, reading]);

  return (
    <AuthGuard>
      <AppShell active="oracle">
        <div className="relative min-h-screen bg-silk-grid bg-[size:24px_24px] bg-center bg-repeat px-10 pb-24 opacity-100">
          <div className="absolute inset-0 opacity-[0.15]" />
          <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-[1fr_1.25fr] gap-12">
            <div className="flex flex-col items-center justify-center py-24">
              <div className="text-center">
                <h2 className="font-display text-[4.8rem] font-black tracking-tight">Seek Guidance</h2>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.28em] text-on-surface/45">
                  Consult the Digital I Ching
                </p>
              </div>

              <form onSubmit={handleDraw} className="mt-12 paper-card flex w-[290px] flex-col items-center px-8 py-10">
                <img
                  alt="Traditional Red Chime Container"
                  className="h-36 w-36 object-contain drop-shadow-2xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBcbBVh1h523XZFQTL7Cv08Rsz53Q6vgRQz27zsfvqgBTYgcJ8CqFwAmgyqpiO3DfXDyQSs2SLfrgwizcT155bh_YsuPE7NH9jbHpAl3WAsnTDQpKdwGxEjp9l_dTmBTchjctPgjBcqhdnc9QIBGkn7MMWyzN3NhggBkBp4xFR5dGNVjW7kg9UE0989ZaYK0ycggf_rKd6fw6BVsP8GFX9-QGmYU2Jj5S2OuI8f_GhgLZ1hA0N_m9LA4qD68AtXbnskE6y-m7j6wm3Z"
                />
                <span className="material-symbols-outlined mt-6 text-primary">vibration</span>
                <button className="mt-2 font-display text-3xl font-bold text-primary">Shake to Reveal</button>
                <textarea
                  className="mt-6 min-h-32 w-full resize-none rounded-3xl bg-surface px-5 py-4 text-sm leading-7 outline-none"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </form>

              <p className="mt-10 text-xs text-on-surface/35">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]">info</span>
                Concentrate on your query before shaking.
              </p>

              <div className="mt-12 w-full max-w-md rounded-[1.6rem] bg-surface-container-low p-6">
                <h4 className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Saved Prophecies</h4>
                <div className="mt-4 space-y-3">
                  {history.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      className="w-full rounded-[1.2rem] bg-surface px-4 py-3 text-left"
                      onClick={() => setReading(item)}
                    >
                      <div className="font-display text-2xl font-bold">{item.title}</div>
                      <div className="text-sm text-on-surface/55">Sign {item.signNumber}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="py-12">
              <OracleResultCard reading={recentReading} streamedInterpretation={streamedInterpretation} />

              <div className="mt-8 rounded-[2rem] bg-surface-container-lowest p-8 shadow-talisman">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-3xl font-bold">Oracle Dialogue</h3>
                    <p className="mt-2 text-sm uppercase tracking-[0.24em] text-on-surface/45">Realtime LLM counsel</p>
                  </div>
                  <div className="rounded-full bg-surface px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
                    {conversations.length} Threads
                  </div>
                </div>

                <div className="grid grid-cols-[240px_1fr] gap-6">
                  <div className="rounded-[1.4rem] bg-surface-container-low p-4">
                    <div className="space-y-2">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => setActiveConversationId(conversation.id)}
                          className={`w-full rounded-[1rem] px-4 py-3 text-left ${activeConversationId === conversation.id ? "bg-surface text-primary" : "text-on-surface/65"}`}
                        >
                          <div className="font-semibold">{conversation.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] bg-surface-container-low p-4">
                    <div className="max-h-[320px] space-y-4 overflow-y-auto scrollbar-thin pr-2">
                      {messages.map((message) => (
                        <div key={message.id} className={`rounded-[1.2rem] px-4 py-3 ${message.role === "assistant" ? "bg-surface" : "bg-primary/8"}`}>
                          <div className="mb-1 text-xs uppercase tracking-[0.2em] text-on-surface/35">{message.role}</div>
                          <div className="whitespace-pre-wrap leading-7">{message.content}</div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleChat} className="mt-4 flex gap-3">
                      <input
                        className="flex-1 rounded-full bg-surface px-5 py-3 outline-none"
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Ask the oracle how Otto should respond..."
                      />
                      <button className="pill-button bg-primary text-on-primary shadow-glow">Send</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
