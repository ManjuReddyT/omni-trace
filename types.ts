
export interface RawLogEntry {
  [key: string]: string | number | undefined;
}

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface ProcessedLogEntry {
  id: string;
  timestamp: string;
  originalTimestamp: string;
  method: string;
  path: string; // Normalized path
  fullRequest: string;
  status: number;
  latency: number; // request_time in ms
  upstreamLatency: number; // upstream_response_time in ms
  userAgent: string;
  remoteIp: string;
  referer: string;
  isError: boolean;
  severity: LogSeverity;
  logType: 'HTTP' | 'DATABASE' | 'SYSTEM' | 'APP' | 'UNKNOWN'; // Differentiate log formats
  bodyBytes: number;
  clusterId?: string; // For pattern grouping
  rawLine: string; // Original raw line for display
  metadata: Record<string, any>; // Flexible bag for extra fields
  anomalyScore?: number; // Statistical deviation score
}

export interface LogCluster {
  id: string;
  template: string; // The pattern with variables replaced
  sample: string;
  count: number;
  errorCount: number;
  avgLatency: number;
  severity: LogSeverity;
}

export interface GoldenSignals {
  latency: number; // p95 in ms
  traffic: number; // req/sec (avg over window)
  errors: number; // % rate
  saturation: number; // abstract score 0-100 based on concurrency/limits
}

export interface AggregatedStats {
  totalRequests: number;
  avgLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  totalBytes: number;
  requestsOverTime: { time: string; count: number; errorCount: number; avgLatency: number }[];
  statusDistribution: { name: string; value: number; fill: string }[];
  topEndpoints: { path: string; count: number; avgLatency: number; errorRate: number }[];
  methodDistribution: { name: string; value: number }[];
  goldenSignals: GoldenSignals;
  clusters: LogCluster[];
  // New Analytics Fields
  latencyHistogram: { range: string; count: number; min: number }[];
  trafficHeatmap: { hour: number; count: number; errorRate: number }[]; // 0-23 hour buckets
  anomalies: ProcessedLogEntry[]; // Logs with high anomaly score (e.g. latency > 3 stddev)
}

export enum FilterTimeRange {
  ALL = 'ALL',
  LAST_15_MIN = 'LAST_15_MIN',
  LAST_HOUR = 'LAST_HOUR',
  LAST_6_HOURS = 'LAST_6_HOURS',
  LAST_24_HOURS = 'LAST_24_HOURS',
}

export interface AppSettings {
  theme: 'dark' | 'light';
  aiProvider: 'gemini' | 'ollama';
  geminiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  aiProvider: 'ollama',
  geminiKey: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
};

export const SETTINGS_STORAGE_KEY = 'omnitrace_settings';

/** Persist settings without the Gemini API key (never write secrets to localStorage). */
export function persistableSettings(settings: AppSettings): Omit<AppSettings, 'geminiKey'> {
  const { geminiKey: _omit, ...rest } = settings;
  return rest;
}

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      geminiKey: '',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
