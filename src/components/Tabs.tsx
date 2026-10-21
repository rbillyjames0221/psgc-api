"use client";
import { useState, type ReactNode } from "react";

export default function Tabs({ tabs }: { tabs: { label: string; content: ReactNode }[] }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="mb-2 flex gap-1 text-sm">
        {tabs.map((t, k) => (
          <button key={t.label} onClick={() => setI(k)}
            className={`rounded-md px-3 py-1 ${k === i ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.label}</button>
        ))}
      </div>
      {tabs[i].content}
    </div>
  );
}
