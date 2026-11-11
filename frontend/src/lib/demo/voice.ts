/**
 * Demo stand-in for the /ws/voice WebSocket (same messages: ready → partial… → final). It uses the browser's own
 * speech recognition when there is one (Chrome, Edge, Safari), otherwise it "hears" a sample sentence.
 * The microphone and level bars still come from use-voice.ts, exactly as in the real app.
 */

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const SAMPLE = "Explain how plants make food from sunlight.";

export class DemoVoiceSocket {
  readyState = 0; // CONNECTING, like WebSocket
  binaryType = "arraybuffer";
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private rec: Rec | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private heard = "";
  private finished = false;

  constructor() {
    this.timers.push(
      setTimeout(() => {
        this.readyState = 1; // OPEN
        this.onopen?.();
      }, 150),
    );
  }

  private emit(msg: unknown) {
    if (this.readyState === 1) this.onmessage?.({ data: JSON.stringify(msg) });
  }

  send(data: unknown) {
    if (typeof data !== "string") return; // audio frames: the browser recogniser listens to the mic itself
    const msg = JSON.parse(data) as { type: string; lang?: string };
    if (msg.type === "start") this.begin(msg.lang ?? "AUTO");
    if (msg.type === "stop") this.end();
  }

  private begin(lang: string) {
    this.emit({ type: "ready" });
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      // No recogniser: type out the sample sentence as partial results, like a real transcription.
      const ws = SAMPLE.split(" ");
      ws.forEach((_, i) => this.timers.push(setTimeout(() => this.emit({ type: "partial", text: ws.slice(0, i + 1).join(" ") }), 400 + i * 250)));
      this.heard = SAMPLE;
      return;
    }
    const rec = new Ctor();
    rec.lang = lang === "KM" ? "km-KH" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      this.heard = (finalText + interim).trim();
      if (this.heard) this.emit({ type: "partial", text: this.heard });
    };
    rec.onerror = () => {
      if (!this.heard) this.heard = SAMPLE;
    };
    rec.onend = () => this.finish();
    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.heard = SAMPLE;
    }
  }

  private end() {
    if (this.rec) this.rec.stop(); // onend → finish
    else this.finish();
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.emit({ type: "final", text: this.heard, language: "en" });
    this.close();
  }

  close() {
    this.timers.forEach(clearTimeout);
    if (this.readyState === 3) return;
    try {
      this.rec?.stop();
    } catch {
      // already stopped
    }
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }
}
