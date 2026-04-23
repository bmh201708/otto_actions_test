import { env, isSttConfigured } from "../config/env";

type BaiduTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type BaiduSttResponse = {
  err_no?: number;
  err_msg?: string;
  result?: string[];
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export class SttNotConfiguredError extends Error {
  constructor() {
    super("Baidu speech recognition is not configured");
  }
}

export async function transcribeWithBaiduSpeech(audio: Buffer, format: "wav" | "pcm" = "wav", sampleRate = 16000) {
  if (!isSttConfigured()) {
    throw new SttNotConfiguredError();
  }

  const token = await getBaiduAccessToken();
  const payload = {
    format,
    rate: sampleRate,
    channel: 1,
    cuid: "otto-voice",
    token,
    dev_pid: 1537,
    speech: audio.toString("base64"),
    len: audio.byteLength
  };

  const response = await fetch("https://vop.baidu.com/server_api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json().catch(() => ({}))) as BaiduSttResponse;
  if (!response.ok) {
    throw new Error(body.err_msg || `Baidu STT request failed with status ${response.status}`);
  }

  if (body.err_no && body.err_no !== 0) {
    throw new Error(body.err_msg || `Baidu STT error ${body.err_no}`);
  }

  return (body.result ?? []).join(" ").trim();
}

async function getBaiduAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.BAIDU_SPEECH_API_KEY!,
    client_secret: env.BAIDU_SPEECH_SECRET_KEY!
  });

  const response = await fetch(`https://aip.baidubce.com/oauth/2.0/token?${params.toString()}`, {
    method: "POST"
  });
  const body = (await response.json().catch(() => ({}))) as BaiduTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "Unable to fetch Baidu speech token");
  }

  cachedToken = {
    token: body.access_token,
    expiresAt: now + Math.max(300_000, (body.expires_in ?? 3600) * 1000)
  };

  return cachedToken.token;
}
