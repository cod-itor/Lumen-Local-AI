import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Runs WebLLM off the main thread (FRONTEND.md §3.4).
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
