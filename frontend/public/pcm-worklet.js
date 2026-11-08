// AudioWorklet (FRONTEND.md §10): mono Float32 at the context rate → 16 kHz Int16 LE frames of exactly 512 samples.
class PcmFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0;
    this.out = new Int16Array(512);
    this.n = 0;
    this.level = 0;
    this.port.onmessage = (e) => {
      if (e.data === "stop") this.stopped = true;
    };
  }

  process(inputs) {
    if (this.stopped) return false;
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // Linear resampling to 16 kHz (ratio 1 when the context already runs at 16 kHz).
    for (; this.pos < ch.length; this.pos += this.ratio) {
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      const a = ch[i];
      const b = i + 1 < ch.length ? ch[i + 1] : a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * f));
      this.level = Math.max(this.level * 0.995, Math.abs(s));
      this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === 512) {
        const frame = this.out.slice();
        this.port.postMessage({ frame: frame.buffer, level: this.level }, [frame.buffer]);
        this.n = 0;
      }
    }
    this.pos -= ch.length;
    return true;
  }
}

registerProcessor("pcm-frames", PcmFrames);
