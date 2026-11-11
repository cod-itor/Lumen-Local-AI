/**
 * Sample "model" for demo mode. No AI runs here: answers come from a few written topics, a generic explainer, a safe
 * calculator, keyword search over the user's own uploaded text, and templates for lessons, quizzes and images.
 */

export type Topic = { keys: RegExp; title: string; en: string; km?: string };

const DEMO_NOTE = "\n\n*Demo version: in the real Lumen app this answer is written by the AI model on your own computer.*";

const TOPICS: Topic[] = [
  {
    keys: /photosynth|រស្មីសំយោគ/i,
    title: "Photosynthesis",
    en: `**Photosynthesis is how plants turn light into food.** Leaves capture sunlight and use its energy to turn water and carbon dioxide into sugar (glucose), releasing oxygen as a by-product.

**How it works, step by step**
1. **Light is absorbed.** Chlorophyll, the green pigment in leaves, absorbs mostly red and blue light. That is why leaves look green: green light is reflected.
2. **Water is split.** The light energy splits water molecules (H₂O). This releases oxygen, which leaves the plant through tiny pores called stomata.
3. **Sugar is built.** In the Calvin cycle, the plant uses the captured energy to join carbon dioxide from the air into glucose.

**The overall equation:** 6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂

**Why it matters:** almost every food chain starts with photosynthesis, and it produces most of the oxygen we breathe.

**Example:** a sunflower in a sunny field grows faster than one in the shade because it can make more sugar for building new leaves and stems.`,
    km: `**រស្មីសំយោគ គឺជាដំណើរការដែលរុក្ខជាតិប្រែក្លាយពន្លឺទៅជាអាហារ។** ស្លឹកចាប់យកពន្លឺព្រះអាទិត្យ ហើយប្រើថាមពលនោះដើម្បីបំប្លែងទឹក និងកាបូនឌីអុកស៊ីត ទៅជាស្ករ (គ្លុយកូស) ហើយបញ្ចេញអុកស៊ីសែន។

1. **ស្រូបពន្លឺ៖** ក្លរ៉ូភីលនៅក្នុងស្លឹកស្រូបពន្លឺ។
2. **បំបែកទឹក៖** ថាមពលពន្លឺបំបែកម៉ូលេគុលទឹក ហើយបញ្ចេញអុកស៊ីសែន។
3. **បង្កើតស្ករ៖** រុក្ខជាតិប្រើថាមពលនោះ ដើម្បីបង្កើតគ្លុយកូសពីកាបូនឌីអុកស៊ីត។

**សារៈសំខាន់៖** ខ្សែសង្វាក់អាហារស្ទើរតែទាំងអស់ចាប់ផ្ដើមពីរស្មីសំយោគ។`,
  },
  {
    keys: /\bpython\b/i,
    title: "Python quiz",
    en: `Here is a short **Python quiz**. Try each one before reading the answers at the end.

**1. What does this print?**
\`\`\`python
nums = [1, 2, 3]
print(len(nums) * 2)
\`\`\`
A) 3  B) 6  C) [1, 2, 3, 1, 2, 3]

**2. Which keyword defines a function?**
A) \`func\`  B) \`def\`  C) \`function\`

**3. What is the type of \`3 / 2\` in Python 3?**
A) \`int\`  B) \`float\`  C) \`str\`

**Answers**
1. **B) 6**: \`len(nums)\` is 3, and 3 × 2 = 6.
2. **B) \`def\`**: for example \`def greet(name): return "Hi " + name\`.
3. **B) \`float\`**: \`/\` always gives a float (1.5). Use \`//\` for whole-number division.

Want harder questions? Ask for "intermediate Python questions", or open **Learning paths** for a full course with quizzes.`,
  },
  {
    keys: /sky.*blue|blue.*sky/i,
    title: "Why the sky is blue",
    en: `**The sky is blue because air scatters blue sunlight much more than red sunlight.** This effect is called *Rayleigh scattering*.

**Why it happens**
- Sunlight contains every colour. Each colour is a different wavelength: blue is short (~450 nm), red is long (~700 nm).
- Gas molecules in the air are far smaller than these wavelengths, and they scatter short wavelengths about **5 times more** than long ones.
- So blue light bounces around the whole sky and reaches your eyes from every direction.

**Why sunsets are red:** at sunset, light travels through much more air. Most of the blue is scattered away before it reaches you, so the reds and oranges are left.

**Example:** on the Moon there is no air to scatter light, so its sky looks black even in daytime.`,
  },
  {
    keys: /water cycle|evaporat|condens/i,
    title: "The water cycle",
    en: `**The water cycle is the continuous journey of water between the ground, the air and back again.**

1. **Evaporation:** the Sun heats oceans, lakes and rivers, and water turns into vapour.
2. **Condensation:** the vapour rises, cools and forms tiny droplets, which become clouds.
3. **Precipitation:** droplets join until they are heavy enough to fall as rain, snow or hail.
4. **Collection:** the water gathers in rivers, lakes, oceans and underground, and the cycle starts again.

**Why it matters:** it delivers fresh water to farms, forests and cities. In Cambodia, the monsoon rains refill the Tonlé Sap lake every year.`,
  },
  {
    keys: /angkor|cambodia|khmer empire/i,
    title: "Angkor Wat",
    en: `**Angkor Wat is a 12th-century temple in Siem Reap, Cambodia, and the largest religious monument in the world.**

- **Who built it:** King Suryavarman II, at the height of the Khmer Empire, first as a Hindu temple to Vishnu. It later became a Buddhist temple.
- **Design:** it represents Mount Meru, home of the gods. The five towers are its peaks and the moat is the ocean around it.
- **Art:** its walls hold hundreds of metres of carved stories, such as the *Churning of the Ocean of Milk*.
- **Today:** it is a UNESCO World Heritage Site and appears on Cambodia's national flag.

**Example:** at the spring equinox, the sun rises directly over the central tower, which shows how carefully it was planned.`,
  },
  {
    keys: /machine learning|artificial intelligence|\bai\b|neural network|llm/i,
    title: "Artificial intelligence",
    en: `**Artificial intelligence (AI) means computer programs that learn patterns from data instead of following only hand-written rules.**

**How a model like the one in Lumen learns**
1. **Training data:** it reads a very large amount of text.
2. **Prediction:** it learns to predict the next word in a sentence. Doing this billions of times teaches it grammar, facts and reasoning patterns.
3. **Use:** when you ask a question, it writes an answer one word at a time from those patterns.

**Its limits:** it can sound confident and still be wrong. That is why Lumen checks answers against your documents or web sources and shows citations like [1].

**Example:** a spam filter is a simple AI. It learned from thousands of emails which words usually mean spam.`,
  },
  {
    keys: /summari[sz]e my notes|my notes/i,
    title: "Summarising notes",
    en: `I can summarise your notes. Open the **Documents** tab and upload them (PDF, Word, TXT or Markdown). Then ask "summarize this document".

In the Documents tab, Lumen:
1. reads your file and splits it into small passages,
2. finds the passages that match your question,
3. answers only from them, with numbered citations [1] that open the exact place in your file.

You can also paste a short piece of text here and ask me to summarise it.`,
  },
  {
    keys: /translat|khmer|ខ្មែរ/i,
    title: "Translation",
    en: `Sure, here is an example of English → Khmer:

| English | Khmer |
|---|---|
| Hello, how are you? | សួស្ដី តើអ្នកសុខសប្បាយទេ? |
| Thank you very much. | អរគុណច្រើន។ |
| I am learning science. | ខ្ញុំកំពុងរៀនវិទ្យាសាស្ត្រ។ |

Send me the sentence you want translated. You can also switch **Answer language** to Khmer or *Both* in Settings, and every answer comes in Khmer.`,
  },
];

const STOP = new Set(
  "a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our please so tell than that the their them then there these they this to us was we what when where which who why will with would you your about explain give more detail details show".split(
    " ",
  ),
);

export const words = (s: string) =>
  (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function topicFor(q: string): Topic | null {
  return TOPICS.find((t) => t.keys.test(q)) ?? null;
}

export const isKhmer = (s: string) => /[ក-៿]/.test(s);

/** Plain answer for any question the topics don't cover. */
function generic(q: string): string {
  const subject = q.replace(/[?.!]+$/, "").trim();
  const key = words(subject).slice(0, 3).join(" ") || "this topic";
  return `Here is a clear overview of **${key}**.

**Short answer:** ${cap(key)} is best understood by looking at what it is, how it works, and why it matters.

**1. What it is**
Start with a one-sentence definition in your own words. A good definition names the category (*a process*, *a tool*, *an event*) and what makes it different from similar things.

**2. How it works**
Break it into steps or parts. For each part, ask "what goes in, and what comes out?" This turns a big idea into small pieces you can remember.

**3. Why it matters**
Connect it to something real: where you see it in daily life, in school, or at work.

**Example:** if you are studying ${key} for an exam, write the three headings above on one page and fill each with two bullet points. That page becomes your revision sheet.

Ask me a follow-up, such as "give me an example", "explain step 2 in more detail" or "quiz me on this".`;
}

export type Answer = { text: string; km?: string; title: string };

/** CHAT pipeline answer. `history` = earlier user questions, so "tell me more" stays on the topic. */
export function chatAnswer(q: string, history: string[]): Answer {
  const followUp = /^(tell me more|more|explain more|continue|go on|why\??|give me an example|example)\b/i.test(q.trim());
  const base = followUp ? history.at(-1) ?? q : q;
  const t = topicFor(base);
  if (t && followUp) {
    return {
      title: t.title,
      text: `Let's go one level deeper on **${t.title.toLowerCase()}**.\n\n${t.en.split("\n\n").slice(1).join("\n\n")}\n\n**A question to check yourself:** can you explain the first step to a friend in two sentences, without looking?${DEMO_NOTE}`,
    };
  }
  if (t) return { title: t.title, text: t.en + DEMO_NOTE, km: t.km };
  return { title: cap(words(q).slice(0, 4).join(" ") || "New chat"), text: generic(q) + DEMO_NOTE };
}

/** WEB pipeline: the same writer, cited against three search-result cards. */
export function webAnswer(q: string): { text: string; sources: { title: string; url: string; siteName: string; snippet: string }[] } {
  const t = topicFor(q);
  const subject = t?.title ?? cap(words(q).slice(0, 4).join(" ") || "your question");
  const enc = encodeURIComponent(subject);
  const sources = [
    {
      title: `${subject} — Wikipedia`,
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${enc}`,
      siteName: "en.wikipedia.org",
      snippet: `An encyclopedia overview of ${subject.toLowerCase()}: background, key facts and history.`,
    },
    {
      title: `${subject} | Britannica`,
      url: `https://www.britannica.com/search?query=${enc}`,
      siteName: "britannica.com",
      snippet: `An expert-reviewed article that explains ${subject.toLowerCase()} with examples.`,
    },
    {
      title: `${subject} explained — Khan Academy`,
      url: `https://www.khanacademy.org/search?page_search_query=${enc}`,
      siteName: "khanacademy.org",
      snippet: `Lessons and practice questions on ${subject.toLowerCase()} for students.`,
    },
  ];
  const body = t
    ? t.en.split("\n\n").slice(0, 3).join("\n\n")
    : `**${subject}** is covered by several reliable sources.`;
  const text = `${body} [1]

**What the sources add**
- The encyclopedia entry gives the background and key facts [1].
- Britannica explains it with worked examples [2].
- Khan Academy has short lessons and practice questions if you want to study it further [3].${DEMO_NOTE}`;
  return { text, sources };
}

/** Very small, safe calculator for "what is 12*7" style questions. Returns null when the text is not plain math. */
export function calculate(q: string): { input: string; output: string } | null {
  const m = q.replace(/,/g, "").match(/(-?\d+(?:\.\d+)?(?:\s*[-+*/x×÷^%]\s*-?\d+(?:\.\d+)?)+)/);
  if (!m) return null;
  const expr = m[1].replace(/[x×]/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  const tokens = expr.match(/\d+(?:\.\d+)?|[-+*/^%]/g);
  if (!tokens) return null;
  // Shunting-yard on numbers and + - * / ^ % only (no eval).
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
  const out: (number | string)[] = [];
  const ops: string[] = [];
  let expectNum = true;
  let neg = false;
  for (const tk of tokens) {
    if (/\d/.test(tk)) {
      out.push(neg ? -Number(tk) : Number(tk));
      neg = false;
      expectNum = false;
    } else if (expectNum && tk === "-") {
      neg = !neg;
    } else {
      while (ops.length && (prec[ops.at(-1)!] > prec[tk] || (prec[ops.at(-1)!] === prec[tk] && tk !== "^"))) out.push(ops.pop()!);
      ops.push(tk);
      expectNum = true;
    }
  }
  while (ops.length) out.push(ops.pop()!);
  const st: number[] = [];
  for (const x of out) {
    if (typeof x === "number") st.push(x);
    else {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) return null;
      st.push(x === "+" ? a + b : x === "-" ? a - b : x === "*" ? a * b : x === "/" ? a / b : x === "%" ? a % b : a ** b);
    }
  }
  if (st.length !== 1 || !Number.isFinite(st[0])) return null;
  const v = Math.round(st[0] * 1e10) / 1e10;
  return { input: m[1].trim(), output: String(v) };
}

/** The demo guardrail: a few clear harmful requests get the same calm refusal the real app gives. */
export function blocked(q: string): boolean {
  return /\b(make|build|how to make).{0,20}\b(bomb|explosive|weapon|poison)|\bkill (him|her|someone|people)|hack (into|someone)/i.test(q);
}
export const REFUSAL =
  "I can't help with that because it could hurt people. If you're studying this for a class, I can explain the history, the science of safety, or how people are protected from it.";

// ---- documents --------------------------------------------------------------------------------------------------

export function chunkPages(pages: string[]): { page: number | null; startChar: number; endChar: number; text: string }[] {
  const out: { page: number | null; startChar: number; endChar: number; text: string }[] = [];
  pages.forEach((text, i) => {
    const page = pages.length > 1 ? i + 1 : null;
    const paras = text.split(/\n\s*\n/);
    let pos = 0;
    let cur = "";
    let curStart = 0;
    for (const p of paras) {
      const at = text.indexOf(p, pos);
      pos = at + p.length;
      if (!p.trim()) continue;
      if (!cur) curStart = at;
      cur = cur ? text.slice(curStart, pos) : p;
      if (cur.length > 700) {
        out.push({ page, startChar: curStart, endChar: pos, text: cur.trim() });
        cur = "";
      }
    }
    if (cur.trim()) out.push({ page, startChar: curStart, endChar: pos, text: cur.trim() });
  });
  return out;
}

const OVERVIEW = /summar|overview|what is this (file|document)|what('s| is) (this|the) (file|document) about|tell me about (this|the) (file|document)|main points/i;

/** Keyword retrieval: chunks sharing the most question words, or the opening chunks for an overview question. */
export function retrieve<T extends { text: string }>(q: string, chunks: T[], k = 3): T[] {
  if (OVERVIEW.test(q)) return chunks.slice(0, k);
  const qw = new Set(words(q));
  if (qw.size === 0) return chunks.slice(0, k);
  return chunks
    .map((c) => {
      const cw = words(c.text);
      const hits = cw.filter((w) => qw.has(w) || [...qw].some((x) => x.length > 4 && w.startsWith(x.slice(0, 5)))).length;
      return { c, score: hits / Math.sqrt(cw.length + 5) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}

const sentences = (t: string) =>
  (t.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 20);

/** An answer made only of sentences from the matched passages, each cited. */
export function ragAnswer(q: string, hits: { text: string }[]): string {
  const qw = new Set(words(q));
  const overview = OVERVIEW.test(q);
  const parts = hits.map((h, i) => {
    const ss = sentences(h.text);
    const ranked = overview
      ? ss.slice(0, 2)
      : ss
          .map((s) => ({ s, n: words(s).filter((w) => qw.has(w)).length }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 2)
          .map((x) => x.s);
    return { n: i + 1, text: (ranked.length ? ranked : [h.text.slice(0, 240)]).join(" ") };
  });
  const intro = overview ? "**Here is what this document covers:**" : "**Here is what your document says:**";
  return `${intro}\n\n${parts.map((p) => `- ${p.text} [${p.n}]`).join("\n")}${DEMO_NOTE}`;
}

export const ABSTAIN_DOCS =
  "I couldn't find this in your documents. Try different words, pick another document, or turn on web search in the Chat tab.";

// ---- learning ----------------------------------------------------------------------------------------------------

export const INTERVIEW = [
  { topic: "level" as const, question: "How much do you already know about this?", options: ["Complete beginner", "I know the basics", "I'm fairly confident"] },
  { topic: "outcome" as const, question: "What do you want to be able to do at the end?", options: ["Pass an exam", "Use it in a project", "Just understand it"] },
  { topic: "time" as const, question: "How much time can you spend each week?", options: ["About 1 hour", "2–3 hours", "5 hours or more"] },
];

export function plan(goal: string) {
  const g = goal.replace(/^(learn|study|understand|master)\s+/i, "").trim() || goal;
  const G = cap(g);
  const steps = [
    { title: `What ${g} is`, summary: `The core idea of ${g} and the words you will meet.`, objectives: [`Explain ${g} in one sentence`, "Know the key terms"] },
    { title: "The main parts", summary: `Break ${g} into its building blocks and see how they fit together.`, objectives: ["Name the main parts", "Describe how they connect"] },
    { title: "How it works in practice", summary: "Walk through a real example from start to finish.", objectives: ["Follow a worked example", "Spot each part in action"] },
    { title: "Common mistakes", summary: "The misunderstandings most learners have, and how to avoid them.", objectives: ["Recognise three common mistakes", "Correct them"] },
    { title: "Putting it together", summary: `Use everything to solve a small ${g} problem on your own.`, objectives: ["Solve a problem alone", "Check your own answer"] },
  ];
  return { title: `${G}: a 5-step path`, level: "BEGINNER" as const, steps };
}

export function lesson(title: string, summary: string, objectives: string[], goal: string): string {
  return `## Overview
${summary} This lesson is part of your path on **${goal}**.

## Key ideas
- **Start simple:** before details, make sure you can say what "${title.toLowerCase()}" means in plain words.
- **Connect it:** link each new idea to something you already know.
- **Practise early:** a small example teaches more than a long definition.

## Example
Imagine explaining "${title.toLowerCase()}" to a friend in two minutes. Write three bullet points: *what it is*, *how it works*, *why it matters*. Read them aloud. If one point feels unclear, that is exactly what to review.

## Check yourself
${objectives.map((o) => `- Can you **${o.charAt(0).toLowerCase() + o.slice(1)}**?`).join("\n")}

*Demo version: in the real app the AI model writes each lesson for your goal and level.*`;
}

export function quiz(title: string) {
  const qs = [
    { question: `What is the best first step when learning "${title}"?`, options: ["Memorise every detail", "Understand the main idea in plain words", "Skip to the hardest part", "Read only the summary"], correct: 1, explanation: "A clear main idea gives every detail a place to fit." },
    { question: "Why does a worked example help?", options: ["It replaces practice", "It shows each idea being used", "It is shorter than a definition", "It hides the hard parts"], correct: 1, explanation: "Seeing ideas in action makes them easier to remember and use." },
    { question: "What should you do when one point feels unclear?", options: ["Ignore it", "Review exactly that point", "Start the whole course again", "Move to the next lesson"], correct: 1, explanation: "Targeted review fixes the gap without wasting time." },
    { question: "Which is a good way to check your understanding?", options: ["Explain it to someone else", "Read it once more", "Highlight the text", "Copy the notes"], correct: 0, explanation: "If you can explain it simply, you understand it." },
    { question: "How often should you practise a new skill?", options: ["Once, for a long time", "In short, regular sessions", "Only before the exam", "Never"], correct: 1, explanation: "Short, spaced practice builds stronger memory than cramming." },
  ];
  return qs;
}

// ---- images ------------------------------------------------------------------------------------------------------

export function clarifyQuestions(request: string) {
  const qs = [
    { id: "style", question: "Which style do you want?", options: ["Photo", "Watercolor", "3D render", "Flat illustration"] },
    { id: "mood", question: "What mood should it have?", options: ["Bright and cheerful", "Calm", "Dramatic", "Mysterious"] },
    { id: "setting", question: "Where should it take place?", options: ["Outdoors in nature", "In a city", "Indoors", "Plain background"] },
  ];
  const given = request.toLowerCase();
  return qs.filter((x) => !x.options.some((o) => given.includes(o.toLowerCase().split(" ")[0])));
}

export function imagePrompt(request: string, answers: Record<string, string>, style?: string): string {
  const bits = [style ?? answers.style, answers.mood, answers.setting].filter(Boolean).map((x) => String(x).toLowerCase());
  return `${cap(request.trim().replace(/[.!]+$/, ""))}${bits.length ? `, ${bits.join(", ")}` : ""}, detailed, soft natural lighting, high quality`;
}

/** Deterministic pseudo-random numbers for a seed (same seed → same picture). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** A generated abstract picture (SVG data URL): gradient sky, layered hills, sun and shapes from the seed. */
export function artSvg(prompt: string, seed: number, w: number, h: number, transparent = false): string {
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  const hue2 = (hue + 40 + Math.floor(r() * 80)) % 360;
  const layers = Array.from({ length: 3 }, (_, i) => {
    const y = h * (0.55 + i * 0.12);
    const pts = Array.from({ length: 7 }, (_, k) => `${(w / 6) * k},${y - r() * h * 0.18}`).join(" L");
    return `<path d="M0,${h} L${pts} L${w},${h} Z" fill="hsl(${(hue2 + i * 12) % 360} ${45 + i * 10}% ${38 - i * 8}%)" opacity="${0.75 + i * 0.1}"/>`;
  }).join("");
  const sun = `<circle cx="${w * (0.2 + r() * 0.6)}" cy="${h * (0.2 + r() * 0.2)}" r="${Math.min(w, h) * (0.08 + r() * 0.06)}" fill="hsl(${(hue + 180) % 360} 90% 75%)"/>`;
  const dots = Array.from({ length: 14 }, () => `<circle cx="${r() * w}" cy="${r() * h * 0.5}" r="${1 + r() * 3}" fill="white" opacity="${0.3 + r() * 0.5}"/>`).join("");
  const bg = transparent
    ? ""
    : `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${hue2} 65% 82%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${dots}`;
  const label = prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt;
  const text = `<text x="${w / 2}" y="${h - 24}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.round(w / 40)}" fill="white" opacity="0.85">${escapeXml(label)} · demo image</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${sun}${layers}${transparent ? "" : text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
