"use client";
import { useEffect, useId, useState } from "react";

export default function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("mermaid").then(async ({ default: m }) => {
      m.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      const { svg } = await m.render(`m${id}`, chart);
      if (alive) setSvg(svg);
    }).catch(() => {});
    return () => { alive = false; };
  }, [chart, id]);
  if (!svg) return <pre className="overflow-auto rounded-lg bg-slate-100 p-3 text-xs">{chart}</pre>;
  return <div className="overflow-auto rounded-lg border border-slate-200 bg-white p-4 [&_svg]:mx-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
