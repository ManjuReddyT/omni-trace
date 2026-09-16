import { ProcessedLogEntry } from '../../types';

export interface LogParser {
  id: string;
  /** When true, unmatched lines are dropped instead of cascading to other parsers. */
  exclusive?: boolean;
  detect(sample: string[]): number;
  parse(line: string, index: number): ProcessedLogEntry | null;
  /** Optional whole-file parse (CSV needs a header context). */
  parseAll?: (lines: string[], startIndex: number) => ProcessedLogEntry[];
}

export interface ParseOptions {
  startIndex?: number;
}
