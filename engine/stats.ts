import { AggregatedStats, ProcessedLogEntry } from '../types';
import { bucketTimestamp, calculatePercentile, detectAnomalies, saturationScore } from './analytics';
import { clusterLogs } from './cluster';

export function aggregateStats(logs: ProcessedLogEntry[]): AggregatedStats {
  const totalRequests = logs.length;
  if (totalRequests === 0) {
    return {
      totalRequests: 0,
      avgLatency: 0,
      p50Latency: 0,
      p90Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: 0,
      totalBytes: 0,
      requestsOverTime: [],
      statusDistribution: [],
      topEndpoints: [],
      methodDistribution: [],
      goldenSignals: { latency: 0, traffic: 0, errors: 0, saturation: 0 },
      clusters: [],
      latencyHistogram: [],
      trafficHeatmap: [],
      anomalies: [],
    };
  }

  const latencies = logs.map((l) => l.latency).sort((a, b) => a - b);
  const totalLatency = latencies.reduce((a, b) => a + b, 0);
  const totalBytes = logs.reduce((a, b) => a + (isNaN(b.bodyBytes) ? 0 : b.bodyBytes), 0);
  const errorCount = logs.filter((l) => l.isError).length;

  const statusCounts: Record<string, number> = {};
  logs.forEach((l) => {
    const cat = l.logType === 'HTTP' ? Math.floor(l.status / 100) + 'xx' : l.isError ? 'Error' : 'Success';
    statusCounts[cat] = (statusCounts[cat] || 0) + 1;
  });

  const statusColors: Record<string, string> = {
    '2xx': '#10b981',
    '3xx': '#3b82f6',
    '4xx': '#f59e0b',
    '5xx': '#ef4444',
    '0xx': '#94a3b8',
    Success: '#10b981',
    Error: '#ef4444',
  };

  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
    fill: statusColors[name] || '#64748b',
  }));

  const endpointMap: Record<string, { count: number; totalLat: number; errors: number }> = {};
  logs.forEach((l) => {
    let key = `${l.method} ${l.path}`;
    if (l.logType === 'DATABASE') key = `[DB] ${l.method} ${l.path}`;
    else if (l.logType === 'SYSTEM') key = `[SYS] ${l.path}`;
    else if (l.logType === 'APP') key = `[APP] ${l.method} ${l.path}`;
    if (!endpointMap[key]) endpointMap[key] = { count: 0, totalLat: 0, errors: 0 };
    endpointMap[key].count++;
    endpointMap[key].totalLat += l.latency;
    if (l.isError) endpointMap[key].errors++;
  });

  const topEndpoints = Object.entries(endpointMap)
    .map(([path, data]) => ({
      path,
      count: data.count,
      avgLatency: data.totalLat / data.count,
      errorRate: (data.errors / data.count) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let minTime = Infinity;
  let maxTime = 0;
  logs.forEach((l) => {
    const t = new Date(l.timestamp).getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;
  });
  const spanMs = Math.max(0, maxTime - minTime);

  const timeMap: Record<string, { count: number; errors: number; totalLat: number }> = {};
  logs.forEach((l) => {
    const bucket = bucketTimestamp(l.timestamp, spanMs);
    if (!timeMap[bucket]) timeMap[bucket] = { count: 0, errors: 0, totalLat: 0 };
    timeMap[bucket].count++;
    timeMap[bucket].totalLat += l.latency;
    if (l.isError) timeMap[bucket].errors++;
  });

  const requestsOverTime = Object.entries(timeMap)
    .map(([time, data]) => ({
      time,
      count: data.count,
      errorCount: data.errors,
      avgLatency: data.totalLat / data.count,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const methodCounts: Record<string, number> = {};
  logs.forEach((l) => {
    methodCounts[l.method] = (methodCounts[l.method] || 0) + 1;
  });
  const methodDistribution = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

  const durationSeconds = spanMs / 1000;
  const traffic = durationSeconds > 0 ? totalRequests / durationSeconds : totalRequests;
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const errorRate = (errorCount / totalRequests) * 100;
  const meanLat = totalLatency / totalRequests;

  const histogramBuckets = 20;
  const maxLat = p95 * 1.5;
  const bucketSize = maxLat / histogramBuckets || 1;
  const histogram: Record<number, number> = {};
  for (let i = 0; i < histogramBuckets; i++) histogram[i] = 0;

  logs.forEach((l) => {
    if (l.latency > maxLat) return;
    const bucketIdx = Math.floor(l.latency / bucketSize);
    if (histogram[bucketIdx] !== undefined) histogram[bucketIdx]++;
  });

  const latencyHistogram = Object.entries(histogram)
    .map(([idx, count]) => {
      const i = parseInt(idx);
      const start = (i * bucketSize).toFixed(0);
      const end = ((i + 1) * bucketSize).toFixed(0);
      return { range: `${start}-${end}ms`, count, min: i * bucketSize };
    })
    .sort((a, b) => a.min - b.min);

  const hourMap: Record<number, { count: number; errors: number }> = {};
  for (let i = 0; i < 24; i++) hourMap[i] = { count: 0, errors: 0 };

  logs.forEach((l) => {
    const h = new Date(l.timestamp).getHours();
    hourMap[h].count++;
    if (l.isError) hourMap[h].errors++;
  });

  const trafficHeatmap = Object.entries(hourMap).map(([h, data]) => ({
    hour: parseInt(h),
    count: data.count,
    errorRate: data.count > 0 ? data.errors / data.count : 0,
  }));

  return {
    totalRequests,
    avgLatency: meanLat,
    p50Latency: p50,
    p90Latency: calculatePercentile(latencies, 90),
    p95Latency: p95,
    p99Latency: calculatePercentile(latencies, 99),
    errorRate,
    totalBytes,
    requestsOverTime,
    statusDistribution,
    topEndpoints,
    methodDistribution,
    goldenSignals: {
      latency: p95,
      traffic,
      errors: errorRate,
      saturation: saturationScore({ traffic, p50, p95, errorRate }),
    },
    clusters: clusterLogs(logs),
    latencyHistogram,
    trafficHeatmap,
    anomalies: detectAnomalies(logs),
  };
}
