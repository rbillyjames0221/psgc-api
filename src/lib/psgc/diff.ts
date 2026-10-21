import type { Counts, Meta } from "../types";
import type { AreaLevel } from "./rows";

export interface DiffEntry { code: string; name: string; level: AreaLevel; parent: string | null; attrs: string }
export interface DiffItem { code: string; level: AreaLevel; name: string; before?: DiffEntry; after?: DiffEntry; changes?: string[] }

export interface DiffResult {
  baseVersion: string | null;
  baseReleaseId: string | null;
  newVersion: string;
  newReleaseId: string | null;
  hasChanges: boolean;
  newRelease: { name: string; date: string | null; asOf: string | null; referenceNo: string | null; sourceFile: string };
  countDelta: Record<string, { before: number | null; after: number; delta: number | null; pct: number | null }>;
  summary: { added: number; removed: number; renamed: number; reparented: number; reclassified: number };
  added: DiffItem[];
  removed: DiffItem[];
  renamed: DiffItem[];
  reparented: DiffItem[];
  reclassified: DiffItem[];
  /** code -> name for every parent referenced, so summaries are readable */
  names: Record<string, string>;
}

export function diffEntries(
  base: DiffEntry[], next: DiffEntry[],
  baseMeta: Pick<Meta, "version" | "counts"> & { releaseId?: string | null } | null,
  nextMeta: Meta & { releaseId?: string | null },
): DiffResult {
  const a = new Map(base.map((e) => [e.code, e]));
  const b = new Map(next.map((e) => [e.code, e]));
  const added: DiffItem[] = [], removed: DiffItem[] = [], renamed: DiffItem[] = [], reparented: DiffItem[] = [], reclassified: DiffItem[] = [];
  for (const [code, e] of b) {
    const o = a.get(code);
    if (!o) { added.push({ code, level: e.level, name: e.name, after: e }); continue; }
    if (o.name !== e.name) renamed.push({ code, level: e.level, name: e.name, before: o, after: e });
    if (o.parent !== e.parent) reparented.push({ code, level: e.level, name: e.name, before: o, after: e });
    const ch: string[] = [];
    if (o.level !== e.level) ch.push(`level ${o.level} -> ${e.level}`);
    if (o.attrs !== e.attrs) ch.push(`${o.attrs} -> ${e.attrs}`);
    if (ch.length) reclassified.push({ code, level: e.level, name: e.name, before: o, after: e, changes: ch });
  }
  for (const [code, o] of a) if (!b.has(code)) removed.push({ code, level: o.level, name: o.name, before: o });

  const names: Record<string, string> = {};
  const needs = new Set<string>();
  for (const list of [added, removed, renamed, reparented, reclassified])
    for (const i of list) { if (i.before?.parent) needs.add(i.before.parent); if (i.after?.parent) needs.add(i.after.parent); }
  for (const c of needs) names[c] = b.get(c)?.name ?? a.get(c)?.name ?? "?";

  const countDelta: DiffResult["countDelta"] = {};
  for (const k of Object.keys(nextMeta.counts) as (keyof Counts)[]) {
    const before = baseMeta?.counts?.[k] ?? null;
    const after = nextMeta.counts[k];
    countDelta[k] = { before, after, delta: before === null ? null : after - before, pct: before ? Math.round(((after - before) / before) * 10000) / 100 : null };
  }
  const summary = { added: added.length, removed: removed.length, renamed: renamed.length, reparented: reparented.length, reclassified: reclassified.length };
  return {
    baseVersion: baseMeta?.version ?? null,
    baseReleaseId: baseMeta?.releaseId ?? null,
    newVersion: nextMeta.version,
    newReleaseId: nextMeta.releaseId ?? null,
    hasChanges: Object.values(summary).some((n) => n > 0),
    newRelease: { name: nextMeta.releaseName, date: nextMeta.releaseDate, asOf: nextMeta.asOf, referenceNo: nextMeta.referenceNo, sourceFile: nextMeta.sourceFile },
    countDelta, summary, added, removed, renamed, reparented, reclassified, names,
  };
}

export function diffToMarkdown(d: DiffResult, opts: { reviewUrl?: string; warnings?: { severity: string; message: string }[]; maxItems?: number } = {}): string {
  const max = opts.maxItems ?? 300;
  const label = (c: string | null | undefined) => (c ? `${d.names[c] ?? "?"} (${c})` : "-");
  const L: string[] = [];
  L.push(`# PSGC update awaiting approval: ${d.baseVersion ?? "(empty)"} -> ${d.newVersion}`, "");
  L.push(`**${d.newRelease.name}**`);
  const bits = [d.newRelease.date && `released ${d.newRelease.date}`, d.newRelease.asOf && `as of ${d.newRelease.asOf}`, d.newRelease.referenceNo && `ref. ${d.newRelease.referenceNo}`].filter(Boolean);
  if (bits.length) L.push(bits.join(", "));
  L.push(`Source: ${d.newRelease.sourceFile}`);
  if (d.newReleaseId) L.push(`Staged release id: \`${d.newReleaseId}\``);
  if (opts.reviewUrl) L.push("", `**Review and approve:** ${opts.reviewUrl}`);
  if (opts.warnings?.length) {
    L.push("", "## Sanity checks", "");
    for (const w of opts.warnings) L.push(`- **${w.severity.toUpperCase()}**: ${w.message}`);
  }
  L.push("", "## Counts", "", "| Level | Current (main) | Staged | Change |", "|---|---:|---:|---:|");
  for (const [k, v] of Object.entries(d.countDelta))
    L.push(`| ${k} | ${v.before ?? "-"} | ${v.after} | ${v.delta === null ? "-" : (v.delta > 0 ? "+" : "") + v.delta}${v.pct ? ` (${v.pct > 0 ? "+" : ""}${v.pct}%)` : ""} |`);
  const s = d.summary;
  L.push("", `Added: ${s.added} | Removed: ${s.removed} | Renamed: ${s.renamed} | Re-parented: ${s.reparented} | Reclassified: ${s.reclassified}`, "");
  const section = (title: string, items: DiffItem[], fmt: (i: DiffItem) => string) => {
    if (!items.length) return;
    L.push(`## ${title} (${items.length})`, "");
    for (const i of items.slice(0, max)) L.push(`- ${fmt(i)}`);
    if (items.length > max) L.push(`- ...and ${items.length - max} more (see JSON)`);
    L.push("");
  };
  section("Added", d.added, (i) => `\`${i.code}\` ${i.name} [${i.level}] in ${label(i.after?.parent)}`);
  section("Removed", d.removed, (i) => `\`${i.code}\` ${i.name} [${i.level}] (was in ${label(i.before?.parent)})`);
  section("Renamed", d.renamed, (i) => `\`${i.code}\` "${i.before!.name}" -> "${i.after!.name}" [${i.level}] in ${label(i.after?.parent)}`);
  section("Re-parented", d.reparented, (i) => `\`${i.code}\` ${i.name} [${i.level}]: ${label(i.before?.parent)} -> ${label(i.after?.parent)}`);
  section("Reclassified", d.reclassified, (i) => `\`${i.code}\` ${i.name} [${i.level}]: ${i.changes!.join("; ")}`);
  if (!d.hasChanges) L.push("No code-level differences between the staged release and main.", "");
  return L.join("\n");
}
