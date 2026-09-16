import { ProcessedLogEntry } from '../types';
import { ParseOptions } from './parsers/types';

export type WorkerParseRequest = {
  type: 'parse';
  id: number;
  startIndex: number;
  buffer: ArrayBuffer;
};

export type WorkerParseResponse =
  | { type: 'result'; id: number; logs: ProcessedLogEntry[] }
  | { type: 'error'; id: number; error: string };

export type { ParseOptions };
