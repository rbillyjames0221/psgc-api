import type { Counts } from "../types";
import type { DiffResult } from "./diff";

export type Severity = "critical" | "warning" | "info";
export interface GuardWarning { severity: Severity; code: string; message: string }

const MAX_DROP_PCT = Number(process.env.GUARD_MAX_DROP_PCT ?? 1);

/** Minimum plausible national totals; anything below suggests a truncated or wrong file. */
const FLOORS: Partial<Counts> = { regions: 17, provinces: 80, cities: 140, municipalities: 1400, barangays: 41000 };

/**
 * Sanity checks run before a staged release is offered for approval.
 * "critical" warnings require explicit acknowledgement on approve.
 */
export function runGuards(input: {
  counts: Counts;
  totalsMatch: boolean | undefined;
  parseWarnings: string[];
  diff: DiffResult;
  mainVersion: string | null;
  newVersion: string;
}): GuardWarning[] {
  const w: GuardWarning[] = [];
  const { counts, diff } = input;

  for (const [k, floor] of Object.entries(FLOORS)) {
    const v = counts[k as keyof Counts];
    if (floor !== undefined && v < floor)
      w.push({ severity: "critical", code: "TRUNCATED", message: `Only ${v} ${k} parsed (expected at least ${floor}). The file may be truncated or not a PSGC publication datafile.` });
  }
  for (const [k, d] of Object.entries(diff.countDelta)) {
    if (d.before && d.delta !== null && d.delta < 0 && (-d.delta / d.before) * 100 > MAX_DROP_PCT)
      w.push({ severity: "critical", code: "COUNT_DROP", message: `${k} dropped by ${-d.delta} (${d.pct}%), more than the ${MAX_DROP_PCT}% threshold.` });
    else if (d.before && d.delta !== null && d.delta > 0 && (d.delta / d.before) * 100 > 5)
      w.push({ severity: "warning", code: "COUNT_JUMP", message: `${k} increased by ${d.delta} (+${d.pct}%). Unusually large for a quarterly update.` });
  }
  const total = Object.values(diff.countDelta).reduce((s, d) => s + (d.before ?? 0), 0);
  if (total && diff.summary.removed / total > 0.005)
    w.push({ severity: "critical", code: "MANY_REMOVED", message: `${diff.summary.removed} codes would be removed (${((diff.summary.removed / total) * 100).toFixed(2)}% of all codes).` });

  const malformed = input.parseWarnings.filter((m) => /not 10 digits|Duplicate code|no parent|no region|Unknown geographic level|unexpected city class/i.test(m));
  if (malformed.length)
    w.push({ severity: "critical", code: "MALFORMED_CODES", message: `${malformed.length} malformed/orphan rows: ${malformed.slice(0, 5).join(" | ")}${malformed.length > 5 ? " ..." : ""}` });

  if (input.totalsMatch === false)
    w.push({ severity: "critical", code: "TOTALS_MISMATCH", message: "Parsed counts do not match the PSA National Summary sheet inside the same workbook." });

  if (input.mainVersion && input.newVersion <= input.mainVersion)
    w.push({ severity: "warning", code: "NOT_NEWER", message: `Staged version ${input.newVersion} is not newer than main (${input.mainVersion}).` });
  if (!diff.hasChanges)
    w.push({ severity: "info", code: "NO_CHANGES", message: "No code-level differences from main. Approving only updates release metadata." });
  return w;
}

export const hasCritical = (w: GuardWarning[]) => w.some((x) => x.severity === "critical");
