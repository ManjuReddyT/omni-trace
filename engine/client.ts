import { ProcessedLogEntry } from '../types';
import { parseLogs } from './parsers';
import type { ParseOptions } from './parsers/types';
import type { WorkerParseRequest, WorkerParseResponse } from './protocol';

type Pending = {
  resolve: (logs: ProcessedLogEntry[]) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerParseResponse>) => {
      const msg = event.data;
      const job = pending.get(msg.id);
      if (!job) return;
      pending.delete(msg.id);
      if (msg.type === 'error') job.reject(new Error(msg.error));
      else job.resolve(msg.logs);
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || 'Log worker failed');
      pending.forEach((job) => job.reject(err));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

/** Parse off the UI thread. Falls back to sync parse if workers are unavailable. */
export function parseLogsInWorker(content: string, options: ParseOptions = {}): Promise<ProcessedLogEntry[]> {
  const w = getWorker();
  if (!w) return Promise.resolve(parseLogs(content, options));

  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      const bytes = new TextEncoder().encode(content);
      const request: WorkerParseRequest = {
        type: 'parse',
        id,
        startIndex: options.startIndex ?? 0,
        buffer: bytes.buffer,
      };
      w.postMessage(request, [bytes.buffer]);
    } catch (err) {
      pending.delete(id);
      resolve(parseLogs(content, options));
    }
  });
}
