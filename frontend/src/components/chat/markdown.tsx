"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./assistant-answer";

/**
 * Assistant Markdown (FRONTEND.md §6.1): GFM, no raw HTML, no images; links open in a new tab without referrer.
 * Styles match the prototype answer blocks.
 */
const components: Components = {
  p: ({ children }) => <p className="text-[15.5px] leading-[26px] text-foreground">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-[23px] text-[15.5px] leading-[26px] text-foreground marker:text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-[23px] text-[15.5px] leading-[26px] text-foreground marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-[2px] [&>p]:inline">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="text-[19px] leading-[28px] font-semibold text-foreground">{children}</h3>,
  h2: ({ children }) => <h3 className="text-[17.5px] leading-[26px] font-semibold text-foreground">{children}</h3>,
  h3: ({ children }) => <h4 className="text-[16px] leading-[24px] font-semibold text-foreground">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-foreground underline decoration-foreground/35 underline-offset-2 hover:decoration-foreground">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[14px] leading-[22px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="border-border" />,
  img: () => null,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children ?? "");
    const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];
    if (lang || text.includes("\n")) return <CodeBlock label={lang ?? "code"} code={text.replace(/\n$/, "")} />;
    return <code className="rounded-[5px] bg-foreground/7 px-[5px] py-px font-mono text-[13.5px]">{children}</code>;
  },
};

/** A sentence the grounding verifier could not support (FRONTEND.md §6.2): matched by its leading text. */
export type Unsupported = { text: string; title: string };

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };
const CITE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

function citeNodes(value: string): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  for (const m of value.matchAll(CITE)) {
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    const ns = m[1].replace(/\s+/g, "");
    out.push({
      type: "lumenCite",
      data: { hName: "span", hProperties: { className: "lumen-cite", "data-n": ns } },
      children: [{ type: "text", value: ns.replace(/,/g, ", ") }],
    });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function splitText(value: string, targets: Unsupported[], cite: boolean): MdNode[] {
  for (const t of targets) {
    const i = t.text ? value.indexOf(t.text) : -1;
    if (i < 0) continue;
    const rest = targets.filter((x) => x !== t);
    return [
      ...(i > 0 ? splitText(value.slice(0, i), rest, cite) : []),
      {
        type: "lumenUnsupported",
        data: { hName: "span", hProperties: { className: "lumen-unsupported", title: t.title } },
        children: [{ type: "text", value: t.text }],
      },
      ...splitText(value.slice(i + t.text.length), rest, cite),
    ];
  }
  return cite ? citeNodes(value) : [{ type: "text", value }];
}

/** remark plugin: `[n]` → citation chips, unsupported sentences → dotted underline. Code is left alone. */
function remarkLumen(opts: { cite: boolean; unsupported: Unsupported[] }) {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    const next: MdNode[] = [];
    for (const child of node.children) {
      if (child.type === "text" && child.value) next.push(...splitText(child.value, opts.unsupported, opts.cite));
      else {
        if (child.type !== "code" && child.type !== "inlineCode") walk(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  return () => (tree: MdNode) => walk(tree);
}

export function Markdown({
  text,
  onCite,
  unsupported = [],
}: {
  text: string;
  /** Turns `[n]` markers into buttons that open source n. */
  onCite?: (n: number) => void;
  unsupported?: Unsupported[];
}) {
  const plugins = onCite || unsupported.length ? [remarkGfm, remarkLumen({ cite: !!onCite, unsupported })] : [remarkGfm];
  const comps: Components = {
    ...components,
    span: ({ className, children, ...rest }) => {
      const props = rest as Record<string, unknown>;
      if (className === "lumen-cite" && onCite) {
        const first = Number(String(props["data-n"] ?? "").split(",")[0]);
        return (
          <button
            type="button"
            onClick={() => onCite(first)}
            className="mx-[2px] inline-flex h-[18px] min-w-[18px] translate-y-[-1px] items-center justify-center rounded-full bg-brand-orange-soft px-[5px] align-middle text-[11px] font-semibold text-foreground transition-colors hover:bg-brand-orange/30"
          >
            {children}
          </button>
        );
      }
      if (className === "lumen-unsupported") {
        return (
          <span title={String(props.title ?? "")} className="underline decoration-brand-orange-strong decoration-dotted decoration-2 underline-offset-4">
            {children}
          </span>
        );
      }
      return <span className={className}>{children}</span>;
    },
  };
  return (
    <div className="flex w-full flex-col gap-[14px]">
      <ReactMarkdown remarkPlugins={plugins} skipHtml components={comps}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
