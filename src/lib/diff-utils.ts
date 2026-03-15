import { diffLines, diffWords } from "diff";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumber?: { old?: number; new?: number };
}

export interface DiffResult {
  lines: DiffLine[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const changes = diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  const stats = { additions: 0, deletions: 0, unchanged: 0 };

  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, "").split("\n");

    for (const line of changeLines) {
      if (change.added) {
        lines.push({
          type: "added",
          value: line,
          lineNumber: { new: newLine },
        });
        newLine++;
        stats.additions++;
      } else if (change.removed) {
        lines.push({
          type: "removed",
          value: line,
          lineNumber: { old: oldLine },
        });
        oldLine++;
        stats.deletions++;
      } else {
        lines.push({
          type: "unchanged",
          value: line,
          lineNumber: { old: oldLine, new: newLine },
        });
        oldLine++;
        newLine++;
        stats.unchanged++;
      }
    }
  }

  return { lines, stats };
}

export interface WordDiffSegment {
  type: "added" | "removed" | "unchanged";
  value: string;
}

export function computeWordDiff(oldText: string, newText: string): WordDiffSegment[] {
  const changes = diffWords(oldText, newText);
  return changes.map((change) => ({
    type: change.added ? "added" : change.removed ? "removed" : "unchanged",
    value: change.value,
  }));
}
