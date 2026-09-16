import { ProcessedLogEntry } from '../../types';
import { csvParser } from './csv';
import { jsonParser } from './json';
import { genericParser, TEXT_PARSERS } from './text';
import { LogParser, ParseOptions } from './types';

export type { LogParser, ParseOptions } from './types';
export { jsonParser } from './json';
export { csvParser } from './csv';
export { TEXT_PARSERS, genericParser } from './text';

export const PARSERS: LogParser[] = [jsonParser, csvParser, ...TEXT_PARSERS];

export function detectFormat(lines: string[]): { id: string; score: number } | null {
  const sample = lines.slice(0, 50);
  let best: { id: string; score: number } | null = null;
  for (const p of PARSERS) {
    const score = p.detect(sample);
    if (!best || score > best.score) best = { id: p.id, score };
  }
  return best && best.score > 0 ? best : null;
}

export function parseLogs(content: string, options: ParseOptions = {}): ProcessedLogEntry[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const startIndex = options.startIndex ?? 0;
  const sample = lines.slice(0, 50);

  const ranked = PARSERS
    .map((p) => ({ p, score: p.detect(sample) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const pinned = top && top.score >= 0.6 ? top.p : null;

  if (pinned?.parseAll) {
    return pinned.parseAll(lines, startIndex);
  }

  const out: ProcessedLogEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const index = startIndex + i;

    if (pinned) {
      const hit = pinned.parse(line, index);
      if (hit) {
        out.push(hit);
        continue;
      }
      if (pinned.exclusive) continue;
    }

    let parsed: ProcessedLogEntry | null = null;
    for (const { p } of ranked) {
      if (p === pinned || p.exclusive) continue;
      parsed = p.parse(line, index);
      if (parsed) break;
    }
    out.push(parsed ?? genericParser.parse(line, index)!);
  }

  return out;
}
