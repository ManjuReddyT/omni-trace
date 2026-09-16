import { AggregatedStats, ProcessedLogEntry } from '../types';
import { clusterLogs } from './cluster';

const calculatePercentile = (sorted: number[], percentile: number) => {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

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

  const timeMap: Record<string, { count: number; errors: number; totalLat: number }> = {};
  let minTime = Infinity;
  let maxTime = 0;

  logs.forEach((l) => {
    const t = new Date(l.timestamp).getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;

    const bucket = l.timestamp.substring(0, 16).replace('T', ' ');
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
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const methodCounts: Record<string, number> = {};
  logs.forEach((l) => {
    methodCounts[l.method] = (methodCounts[l.method] || 0) + 1;
  });
  const methodDistribution = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

  const durationSeconds = (maxTime - minTime) / 1000;
  const traffic = durationSeconds > 0 ? totalRequests / durationSeconds : totalRequests;
  const p95 = calculatePercentile(latencies, 95);

  const histogramBuckets = 20;
  const maxLat = p95 * 1.5;
  const bucketSize = maxLat / histogramBuckets;
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

  const meanLat = totalLatency / totalRequests;
  const variance = latencies.reduce((sum, val) => sum + Math.pow(val - meanLat, 2), 0) / totalRequests;
  const stdDev = Math.sqrt(variance);

  const anomalies = logs
    .map((l) => {
      const zScore = (l.latency - meanLat) / (stdDev || 1);
      return { ...l, anomalyScore: zScore };
    })
    .filter((l) => {
      const isOutlier = l.anomalyScore! > 3 && l.latency > 100;
      const isCritical = l.status >= 500;
      return isOutlier || isCritical;
    })
    .sort((a, b) => b.latency - a.latency)
    .slice(0, 50);

  return {
    totalRequests,
    avgLatency: meanLat,
    p50Latency: calculatePercentile(latencies, 50),
    p90Latency: calculatePercentile(latencies, 90),
    p95Latency: p95,
    p99Latency: calculatePercentile(latencies, 99),
    errorRate: (errorCount / totalRequests) * 100,
    totalBytes,
    requestsOverTime,
    statusDistribution,
    topEndpoints,
    methodDistribution,
    goldenSignals: {
      latency: p95,
      traffic,
      errors: (errorCount / totalRequests) * 100,
      saturation: Math.min((traffic / 100) * 100, 100),
    },
    clusters: clusterLogs(logs),
    latencyHistogram,
    trafficHeatmap,
    anomalies,
  };
}
