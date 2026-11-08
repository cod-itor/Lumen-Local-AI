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

export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex w-full flex-col gap-[14px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
