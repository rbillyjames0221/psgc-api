"use client";
import { useState } from "react";

export default function CodeBlock({ code, lang, title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">
        <span>{title ?? lang ?? ""}</span>
        <button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="rounded px-2 py-0.5 hover:bg-slate-800 hover:text-white">{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="max-h-[560px] overflow-auto p-3 text-[12.5px] leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}
