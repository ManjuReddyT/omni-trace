import { describe, expect, it } from 'vitest';
import {
  aggregateStats,
  bucketTimestamp,
  clusterLogs,
  detectAnomalies,
  parseLogs,
  queryLogs,
  registerParser,
  saturationScore,
} from '../engine';
import type { LogParser } from '../engine';
import { ProcessedLogEntry } from '../types';

function log(partial: Partial<ProcessedLogEntry>): ProcessedLogEntry {
  return {
    id: partial.id || 'x',
    timestamp: partial.timestamp || '2025-01-17T14:32:00.000Z',
    originalTimestamp: '',
    method: partial.method || 'GET',
    path: partial.path || '/api',
    fullRequest: partial.fullRequest || 'GET /api',
    status: partial.status ?? 200,
    latency: partial.latency ?? 10,
    upstreamLatency: 0,
    userAgent: '-',
    remoteIp: '-',
    referer: '-',
    isError: partial.isError ?? (partial.status !== undefined && partial.status >= 400),
    severity: partial.severity || 'INFO',
    logType: partial.logType || 'HTTP',
    bodyBytes: 0,
    rawLine: partial.rawLine || '',
    metadata: {},
    ...partial,
  };
}

describe('Drain clustering', () => {
  it('groups the same shape with different ids into one template', () => {
    const clusters = clusterLogs([
      log({ fullRequest: 'GET /users/1 HTTP/1.1' }),
      log({ fullRequest: 'GET /users/2 HTTP/1.1' }),
      log({ fullRequest: 'GET /users/99 HTTP/1.1' }),
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].template).toMatch(/<\*>/);
  });

  it('keeps GET and POST as separate clusters', () => {
    const clusters = clusterLogs([
      log({ fullRequest: 'GET /users/1 HTTP/1.1' }),
      log({ fullRequest: 'POST /orders HTTP/1.1' }),
    ]);
    expect(clusters.length).toBe(2);
  });
});

describe('per-endpoint anomalies', () => {
  it('does not flag a slow endpoint just because another is fast', () => {
    const logs: ProcessedLogEntry[] = [
      ...Array.from({ length: 8 }, (_, i) => log({ id: `h${i}`, path: '/health', latency: 5 })),
      ...Array.from({ length: 8 }, (_, i) => log({ id: `c${i}`, path: '/checkout', latency: 400 })),
    ];
    const anomalies = detectAnomalies(logs);
    expect(anomalies.filter((a) => a.path === '/checkout' && a.status === 200)).toHaveLength(0);
  });

  it('flags an outlier on the same endpoint and always flags 5xx', () => {
    const logs = [
      ...Array.from({ length: 8 }, (_, i) => log({ id: `ok${i}`, path: '/api', latency: 20 })),
      log({ id: 'slow', path: '/api', latency: 5000 }),
      log({ id: 'boom', path: '/other', latency: 10, status: 500, isError: true }),
    ];
    const anomalies = detectAnomalies(logs);
    expect(anomalies.some((a) => a.id === 'slow')).toBe(true);
    expect(anomalies.some((a) => a.id === 'boom')).toBe(true);
  });
});

describe('saturation', () => {
  it('is not min(req/s, 100)', () => {
    const low = saturationScore({ traffic: 80, p50: 10, p95: 12, errorRate: 0 });
    expect(low).toBeLessThan(80);
  });

  it('rises with errors and latency inflation', () => {
    const calm = saturationScore({ traffic: 2, p50: 20, p95: 22, errorRate: 0 });
    const hot = saturationScore({ traffic: 2, p50: 20, p95: 200, errorRate: 20 });
    expect(hot).toBeGreaterThan(calm);
  });
});

describe('adaptive time buckets', () => {
  it('uses seconds for a short span', () => {
    expect(bucketTimestamp('2025-01-17T14:32:01.000Z', 30_000)).toBe('2025-01-17 14:32:01');
  });

  it('uses minutes for an hour-scale span', () => {
    expect(bucketTimestamp('2025-01-17T14:32:01.000Z', 60 * 60 * 1000)).toBe('2025-01-17 14:32');
  });
});

describe('time-sliced query', () => {
  it('keeps only the last 15 minutes relative to the newest log', () => {
    const logs = [
      log({ id: 'old', timestamp: '2025-01-17T14:00:00.000Z' }),
      log({ id: 'new', timestamp: '2025-01-17T14:32:00.000Z' }),
    ];
    const sliced = queryLogs(logs, { timeRange: '15M' });
    expect(sliced.map((l) => l.id)).toEqual(['new']);
  });

  it('filters methods after the time slice', () => {
    const logs = [
      log({ id: 'g', method: 'GET', timestamp: '2025-01-17T14:32:00.000Z' }),
      log({ id: 'p', method: 'POST', timestamp: '2025-01-17T14:32:00.000Z' }),
    ];
    expect(queryLogs(logs, { methods: ['POST'] }).map((l) => l.id)).toEqual(['p']);
  });
});

describe('parser plugins', () => {
  it('lets a custom parser win on detect', () => {
    const parser: LogParser = {
      id: 'toy',
      exclusive: true,
      detect: (sample) => (sample[0]?.startsWith('TOY ') ? 1 : 0),
      parse: (line, index) =>
        log({
          id: `toy-${index}`,
          method: 'TOY',
          path: line.slice(4),
          fullRequest: line,
          rawLine: line,
        }),
    };
    const unregister = registerParser(parser);
    try {
      const logs = parseLogs('TOY /widget');
      expect(logs[0].method).toBe('TOY');
      expect(logs[0].path).toBe('/widget');
    } finally {
      unregister();
    }
  });
});

describe('aggregateStats wiring', () => {
  it('returns clusters and a saturation that is not raw rps', () => {
    const parsed = parseLogs(
      `203.0.113.42 - - [17/Jan/2025:14:32:01 +0000] "GET /api/users/1 HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
203.0.113.42 - - [17/Jan/2025:14:32:02 +0000] "GET /api/users/2 HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
203.0.113.42 - - [17/Jan/2025:14:32:03 +0000] "GET /api/users/3 HTTP/1.1" 500 12 "-" "Mozilla/5.0"`
    );
    const stats = aggregateStats(parsed);
    expect(stats.clusters.length).toBeGreaterThan(0);
    expect(stats.goldenSignals.saturation).toBeLessThanOrEqual(100);
    expect(stats.anomalies.some((a) => a.status === 500)).toBe(true);
  });
});
