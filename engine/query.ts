import { ProcessedLogEntry } from '../types';

export type TimeRange = 'ALL' | '15M' | '1H' | '6H' | '24H';

export interface LogQuery {
  text?: string;
  methods?: string[];
  statusClasses?: string[];
  logTypes?: string[];
  minLatency?: number;
  maxLatency?: number;
  timeRange?: TimeRange;
}

const RANGE_MS: Record<Exclude<TimeRange, 'ALL'>, number> = {
  '15M': 15 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
};

function statusClassOf(log: ProcessedLogEntry): string {
  if (log.logType === 'HTTP') return `${Math.floor(log.status / 100)}xx`;
  return log.isError ? 'Error' : 'Success';
}

function matchesText(log: ProcessedLogEntry, text: string): boolean {
  if (!text) return true;
  const ft = text.toLowerCase();
  let logKey = `${log.method} ${log.path}`.toLowerCase();
  if (log.logType === 'DATABASE') logKey = `[db] ${logKey}`;
  else if (log.logType === 'SYSTEM') logKey = `[sys] ${log.path.toLowerCase()}`;
  else if (log.logType === 'APP') logKey = `[app] ${logKey}`;
  return logKey.includes(ft) || log.fullRequest.toLowerCase().includes(ft);
}

/** Time-slice first, then cheap predicates. Used by the dashboard filter bar. */
export function queryLogs(logs: ProcessedLogEntry[], query: LogQuery = {}): ProcessedLogEntry[] {
  const {
    text = '',
    methods = [],
    statusClasses = [],
    logTypes = [],
    minLatency = 0,
    maxLatency = Infinity,
    timeRange = 'ALL',
  } = query;

  let sliced = logs;
  if (timeRange !== 'ALL' && logs.length > 0) {
    let latest = 0;
    for (const log of logs) {
      const t = new Date(log.timestamp).getTime();
      if (t > latest) latest = t;
    }
    const cutoff = latest - RANGE_MS[timeRange];
    sliced = logs.filter((log) => new Date(log.timestamp).getTime() >= cutoff);
  }

  const hasMethods = methods.length > 0;
  const hasStatus = statusClasses.length > 0;
  const hasTypes = logTypes.length > 0;
  const hasLatency = minLatency > 0 || Number.isFinite(maxLatency);
  const hasText = text !== '';

  if (!hasMethods && !hasStatus && !hasTypes && !hasLatency && !hasText) return sliced;

  return sliced.filter((log) => {
    if (hasText && !matchesText(log, text)) return false;
    if (hasTypes && !logTypes.includes(log.logType)) return false;
    if (hasMethods && !methods.includes(log.method)) return false;
    if (hasStatus && !statusClasses.includes(statusClassOf(log))) return false;
    if (log.latency < minLatency || log.latency > maxLatency) return false;
    return true;
  });
}
