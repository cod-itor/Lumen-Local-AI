/**
 * Text extraction for demo uploads, using only built-in browser APIs (no packages):
 * TXT/MD as text, DOCX by unzipping word/document.xml with DecompressionStream, PDF best effort (text operators in
 * the page streams). When nothing readable comes out, the caller shows the same SCANNED_PDF/PARSE_FAILED errors as
 * the real app.
 */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const out = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** zlib inflate that keeps what it decoded when the stream has trailing bytes (common in PDFs). */
async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  let end = data.length;
  while (end > 0 && (data[end - 1] === 0x0a || data[end - 1] === 0x0d)) end--;
  const reader = new Blob([data.subarray(0, end) as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value);
    }
  } catch {
    // trailing junk after the compressed data: keep what was decoded
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Reads one entry of a ZIP file through its central directory. */
async function unzipEntry(buf: Uint8Array, name: string): Promise<Uint8Array | null> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) return null;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const entry = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (entry === name) {
      const lNameLen = v.getUint16(local + 26, true);
      const lExtraLen = v.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

async function docxText(buf: Uint8Array): Promise<string> {
  const xml = await unzipEntry(buf, "word/document.xml");
  if (!xml) return "";
  const s = new TextDecoder().decode(xml);
  const paras = s.split(/<\/w:p>/).map((p) => {
    const runs = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => (m[1] !== undefined ? m[1] : " "));
    return decodeXml(runs.join(""));
  });
  return paras.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Raw bytes (as latin1 chars) of a PDF literal string, with escapes resolved. */
function pdfLiteralBytes(s: string): string {
  return s.replace(/\\(?:([nrtbf()\\])|(\d{1,3})|\r?\n)/g, (_, c: string | undefined, o: string | undefined) => {
    if (o) return String.fromCharCode(parseInt(o, 8) & 0xff);
    if (!c) return "";
    return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[c] ?? c;
  });
}

type CMap = { bytes: number; map: Map<number, string> };

const utf16 = (hex: string) => {
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
};

/** Parses a ToUnicode CMap (bfchar + bfrange). */
function parseCMap(text: string): CMap {
  const map = new Map<number, string>();
  let bytes = 1;
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      bytes = Math.max(bytes, m[1].length / 2);
      map.set(parseInt(m[1], 16), utf16(m[2]));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      bytes = Math.max(bytes, m[1].length / 2);
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[3].startsWith("[")) {
        [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].forEach((d, i) => map.set(lo + i, utf16(d[1])));
      } else {
        const base = m[3].slice(1, -1);
        const head = base.slice(0, -4);
        const last = parseInt(base.slice(-4) || "0", 16);
        for (let c = lo; c <= hi; c++) map.set(c, utf16(head + (last + c - lo).toString(16).padStart(4, "0")));
      }
    }
  }
  return { bytes, map };
}

function decodeWith(raw: string, cmap: CMap | undefined): string {
  if (!cmap) return raw;
  let out = "";
  for (let i = 0; i + cmap.bytes <= raw.length; i += cmap.bytes) {
    let code = 0;
    for (let k = 0; k < cmap.bytes; k++) code = code * 256 + raw.charCodeAt(i + k);
    out += cmap.map.get(code) ?? "";
  }
  return out;
}

/**
 * Best effort PDF text: builds the object table, maps font names to their ToUnicode CMaps, then reads every
 * content stream's text operators (Tf, Tj, TJ, quote operators; Td, TD, T-star and Tm start new lines).
 */
async function pdfPages(buf: Uint8Array): Promise<string[]> {
  const latin = new TextDecoder("latin1").decode(buf);
  const objects = new Map<number, { start: number; end: number }>();
  for (const m of latin.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const end = latin.indexOf("endobj", m.index);
    if (end > 0) objects.set(Number(m[1]), { start: m.index, end });
  }
  const streamCache = new Map<number, string | null>();
  const streamOf = async (num: number): Promise<string | null> => {
    if (streamCache.has(num)) return streamCache.get(num)!;
    const o = objects.get(num);
    let text: string | null = null;
    if (o) {
      const head = /stream\r?\n/.exec(latin.slice(o.start, o.end));
      if (head) {
        const s = o.start + head.index + head[0].length;
        const e = latin.lastIndexOf("endstream", o.end);
        let body = buf.subarray(s, e > s ? e : s);
        if (/FlateDecode/.test(latin.slice(o.start, o.start + head.index))) body = await inflateZlib(body);
        text = new TextDecoder("latin1").decode(body);
      }
    }
    streamCache.set(num, text);
    return text;
  };
  const objText = (num: number) => {
    const o = objects.get(num);
    return o ? latin.slice(o.start, o.end) : "";
  };

  // Font resource name → CMap (from /Font << /F1 12 0 R >> dictionaries, direct or indirect).
  const fonts = new Map<string, CMap>();
  const fontDicts: string[] = [];
  for (const m of latin.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) fontDicts.push(m[1]);
  for (const m of latin.matchAll(/\/Font\s+(\d+)\s+\d+\s+R/g)) fontDicts.push(objText(Number(m[1])));
  for (const dict of fontDicts) {
    for (const f of dict.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
      if (fonts.has(f[1])) continue;
      const tu = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(objText(Number(f[2])));
      const cm = tu ? await streamOf(Number(tu[1])) : null;
      if (cm) fonts.set(f[1], parseCMap(cm));
    }
  }

  const pages: string[] = [];
  for (const num of [...objects.keys()].sort((a, b) => a - b)) {
    const head = objText(num);
    if (!/stream\r?\n/.test(head) || /\/(Type\s*\/XRef|Subtype\s*\/Image|Length1|Type\s*\/ObjStm)/.test(head.slice(0, 400))) continue;
    const content = await streamOf(num);
    if (!content || !/\bT[Jj*]\b|'/.test(content) || !/\bBT\b/.test(content)) continue;
    let font: CMap | undefined;
    let line = "";
    const lines: string[] = [];
    const flush = () => {
      const t = line.replace(/\s+/g, " ").trim();
      if (t) lines.push(t);
      line = "";
    };
    const tokens = content.matchAll(/\((?:\\[\s\S]|[^\\)])*\)|<[0-9a-fA-F\s]*>|\[|\]|\/[^\s/<>\[\]()]+|-?\d*\.?\d+|[A-Za-z'"*]+/g);
    const stack: string[] = [];
    let inArray = false;
    for (const t of tokens) {
      const tk = t[0];
      if (tk === "[") {
        inArray = true;
        continue;
      }
      if (tk === "]") {
        inArray = false;
        continue;
      }
      if (tk.startsWith("(") || tk.startsWith("<")) {
        const raw = tk.startsWith("(") ? pdfLiteralBytes(tk.slice(1, -1)) : tk.slice(1, -1).replace(/\s+/g, "").replace(/(..)/g, (h) => String.fromCharCode(parseInt(h, 16)));
        const txt = font ? decodeWith(raw, font) : raw;
        if (inArray) line += txt;
        else stack.push(txt);
        continue;
      }
      if (/^-?\d*\.?\d+$/.test(tk)) {
        if (inArray && Number(tk) < -180) line += " ";
        else stack.push(tk);
        continue;
      }
      if (tk.startsWith("/")) {
        stack.push(tk);
        continue;
      }
      switch (tk) {
        case "Tf":
          font = fonts.get(stack.at(-2)?.slice(1) ?? "");
          break;
        case "Tj":
          line += stack.at(-1) ?? "";
          break;
        case "'":
        case '"':
          flush();
          line += stack.at(-1) ?? "";
          break;
        case "T*":
          flush();
          break;
        case "Td":
        case "TD":
          if (Math.abs(Number(stack.at(-1))) > 0.01) flush();
          else line += " ";
          break;
        case "Tm":
          flush();
          break;
        case "ET":
          flush();
          break;
      }
      stack.length = 0;
    }
    flush();
    const page = lines.join("\n");
    if (page.trim()) pages.push(page);
  }
  return pages;
}

/** Text is usable when most of it is ordinary letters, digits, spaces and punctuation. */
function readable(s: string): boolean {
  if (s.trim().length < 30) return false;
  const good = (s.match(/[\p{L}\p{N}\s.,;:!?'"()\-–—%/]/gu) ?? []).length;
  return good / s.length > 0.85;
}

export type Extracted = { pages: string[]; paginated: boolean } | { error: "SCANNED_PDF" | "PARSE_FAILED" | "EMPTY_DOCUMENT" };

export async function extractText(file: File): Promise<Extracted> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const pages = (await pdfPages(new Uint8Array(await file.arrayBuffer()))).filter(readable);
      if (pages.length === 0) return { error: "SCANNED_PDF" };
      return { pages, paginated: true };
    }
    if (name.endsWith(".docx")) {
      const t = await docxText(new Uint8Array(await file.arrayBuffer()));
      return t.trim() ? { pages: [t], paginated: false } : { error: "EMPTY_DOCUMENT" };
    }
    const t = await file.text();
    return t.trim() ? { pages: [t], paginated: false } : { error: "EMPTY_DOCUMENT" };
  } catch {
    return { error: "PARSE_FAILED" };
  }
}
