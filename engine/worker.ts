import { parseLogs } from './parsers';
import type { WorkerParseRequest, WorkerParseResponse } from './protocol';

self.onmessage = (event: MessageEvent<WorkerParseRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'parse') return;

  try {
    const content = new TextDecoder().decode(msg.buffer);
    const logs = parseLogs(content, { startIndex: msg.startIndex });
    const response: WorkerParseResponse = { type: 'result', id: msg.id, logs };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerParseResponse = {
      type: 'error',
      id: msg.id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
