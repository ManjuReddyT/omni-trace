import { LogCluster, ProcessedLogEntry } from '../types';
import { makeLogId } from './id';

export function generateLogTemplate(message: string): string {
  let template = message
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TIMESTAMP>')
    .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '<IP>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/=\d+/g, '=<NUM>')
    .replace(/:\d+/g, ':<NUM>')
    .replace(/"[^"]{20,}"/g, '"<STR>"');

  return template.substring(0, 150);
}

export function clusterLogs(logs: ProcessedLogEntry[]): LogCluster[] {
  const clusterMap: Record<string, LogCluster> = {};
  logs.forEach((l) => {
    const template = generateLogTemplate(l.fullRequest);
    if (!clusterMap[template]) {
      clusterMap[template] = {
        id: makeLogId(template, 0),
        template,
        sample: l.fullRequest,
        count: 0,
        errorCount: 0,
        avgLatency: 0,
        severity: l.severity,
      };
    }
    const c = clusterMap[template];
    c.count++;
    if (l.isError) c.errorCount++;
    c.avgLatency += l.latency;
  });

  return Object.values(clusterMap)
    .map((c) => ({ ...c, avgLatency: c.avgLatency / c.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}
