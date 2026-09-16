/** Stable FNV-1a id from line content + absolute index (survives append / re-parse). */
export function makeLogId(line: string, index: number): string {
  let h = 2166136261;
  const s = `${index}:${line}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `log-${(h >>> 0).toString(36)}`;
}
