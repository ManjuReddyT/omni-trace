import { ProcessedLogEntry } from '../types';

export function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function endpointKey(log: ProcessedLogEntry): string {
  return `${log.method} ${log.path}`;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function robustZ(values: number[], x: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const absDev = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = median(absDev);
  if (mad < 1e-6) {
    return x > Math.max(med * 5, med + 50) ? 10 : 0;
  }
  return (0.6745 * (x - med)) / mad;
}

/**
 * Flag latency outliers against the *same endpoint*, not the global mix.
 * Uses a robust (median / MAD) z-score so one slow call cannot hide itself.
 * Always keep 5xx. Need ≥3 samples on the endpoint before z-score applies.
 */
export function detectAnomalies(logs: ProcessedLogEntry[]): ProcessedLogEntry[] {
  const groups = new Map<string, number[]>();
  for (const log of logs) {
    const key = endpointKey(log);
    const list = groups.get(key);
    if (list) list.push(log.latency);
    else groups.set(key, [log.latency]);
  }

  const scored = logs.map((log) => {
    const samples = groups.get(endpointKey(log))!;
    const zScore = samples.length >= 3 ? robustZ(samples, log.latency) : 0;
    return { ...log, anomalyScore: zScore };
  });

  return scored
    .filter((log) => {
      const isCritical = log.status >= 500;
      const isOutlier = log.anomalyScore! > 3 && log.latency > 50;
      return isCritical || isOutlier;
    })
    .sort((a, b) => b.latency - a.latency)
    .slice(0, 50);
}

/**
 * Saturation from Little's-law occupancy, error pressure, and p95/p50 inflation.
 * Not `min(req/s, 100)`.
 */
export function saturationScore(opts: {
  traffic: number;
  p50: number;
  p95: number;
  errorRate: number;
}): number {
  const inFlight = opts.traffic * (opts.p95 / 1000);
  const occupancy = Math.min(100, (inFlight / 8) * 100);
  const errorPressure = Math.min(100, opts.errorRate * 5);
  const inflation = opts.p50 > 0 ? opts.p95 / opts.p50 : 1;
  const latencyPressure = Math.min(100, Math.max(0, ((inflation - 1) / 3) * 100));
  return Math.min(100, 0.5 * occupancy + 0.3 * errorPressure + 0.2 * latencyPressure);
}

/** Pick a time-series bucket width from the observed span. */
export function bucketTimestamp(iso: string, spanMs: number): string {
  if (!iso) return '';
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso;
  if (spanMs <= 2 * 60 * 1000) {
    return utc.substring(0, 19).replace('T', ' ');
  }
  if (spanMs <= 2 * 60 * 60 * 1000) {
    return utc.substring(0, 16).replace('T', ' ');
  }
  if (spanMs <= 2 * 24 * 60 * 60 * 1000) {
    const mins = utc.substring(14, 16);
    const rounded = String(Math.floor(Number(mins) / 10) * 10).padStart(2, '0');
    return `${utc.substring(0, 13).replace('T', ' ')}:${rounded}`;
  }
  return `${utc.substring(0, 13).replace('T', ' ')}:00`;
}
