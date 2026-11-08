"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

/** Voice input (FRONTEND.md §10): token → WebSocket to the backend relay → 16 kHz PCM frames → partial/final text. */
export type VoiceError = "PERMISSION" | "VOICE_BUSY" | "FEATURE_UNAVAILABLE" | "FAILED";
export type VoiceState = "idle" | "connecting" | "listening" | "stopping";

type ServerMsg =
  | { type: "ready" }
  | { type: "partial"; text: string }
  | { type: "final"; text: string; language: string }
  | { type: "error"; code: string; message: string };

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";

export function useVoice(onFinal: (text: string) => void, lang: "EN" | "KM" | "AUTO" = "AUTO") {
  const [state, setState] = useState<VoiceState>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);
  const [level, setLevel] = useState(0);
  const parts = useRef<{ ws?: WebSocket; ctx?: AudioContext; stream?: MediaStream; node?: AudioWorkletNode }>({});
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  const cleanup = useCallback(() => {
    const p = parts.current;
    p.node?.port.postMessage("stop");
    p.node?.disconnect();
    p.stream?.getTracks().forEach((t) => t.stop());
    void p.ctx?.close().catch(() => undefined);
    if (p.ws && p.ws.readyState <= WebSocket.OPEN) p.ws.close();
    parts.current = {};
    setPartial("");
    setLevel(0);
    setState("idle");
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (parts.current.ws) return;
    setError(null);
    setState("connecting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError("PERMISSION");
      setState("idle");
      return;
    }
    parts.current.stream = stream;
    let token: string;
    try {
      token = (await api.post<{ token: string }>("/api/voice/token")).token;
    } catch (e) {
      setError(e instanceof ApiError && e.code === "FEATURE_UNAVAILABLE" ? "FEATURE_UNAVAILABLE" : "FAILED");
      cleanup();
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ sampleRate: 16000 });
    } catch {
      ctx = new AudioContext(); // the worklet resamples
    }
    parts.current.ctx = ctx;
    await ctx.audioWorklet.addModule("/pcm-worklet.js");
    const node = new AudioWorkletNode(ctx, "pcm-frames");
    parts.current.node = node;
    ctx.createMediaStreamSource(stream).connect(node);

    const ws = new WebSocket(`${WS_URL}/ws/voice?token=${encodeURIComponent(token)}`);
    ws.binaryType = "arraybuffer";
    parts.current.ws = ws;
    let ready = false;
    node.port.onmessage = (e: MessageEvent<{ frame: ArrayBuffer; level: number }>) => {
      setLevel(e.data.level);
      if (ready && ws.readyState === WebSocket.OPEN) ws.send(e.data.frame);
    };
    ws.onopen = () => ws.send(JSON.stringify({ type: "start", lang, sampleRate: 16000 }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data)) as ServerMsg;
      if (msg.type === "ready") {
        ready = true;
        setState("listening");
      } else if (msg.type === "partial") setPartial(msg.text);
      else if (msg.type === "final") {
        setPartial("");
        if (msg.text.trim()) finalRef.current(msg.text.trim());
      } else if (msg.type === "error") {
        setError(msg.code === "VOICE_BUSY" || msg.code === "FEATURE_UNAVAILABLE" ? msg.code : "FAILED");
      }
    };
    ws.onclose = () => cleanup();
    ws.onerror = () => setError((x) => x ?? "FAILED");
  }, [cleanup, lang]);

  /** Ask the server for the last `final`, then it closes the socket (which cleans up). */
  const stop = useCallback(() => {
    const p = parts.current;
    if (!p.ws) return;
    p.node?.port.postMessage("stop");
    p.stream?.getTracks().forEach((t) => t.stop());
    if (p.ws.readyState === WebSocket.OPEN) {
      setState("stopping");
      p.ws.send(JSON.stringify({ type: "stop" }));
      setTimeout(() => parts.current.ws === p.ws && cleanup(), 15000);
    } else cleanup();
  }, [cleanup]);

  return { state, partial, error, level, start, stop, clearError: () => setError(null) };
}
