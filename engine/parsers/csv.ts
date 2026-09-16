import { ProcessedLogEntry } from '../../types';
import { determineSeverity, normalizePath, parseDate } from '../helpers';
import { makeLogId } from '../id';
import { LogParser } from './types';

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((c) => c.trim().replace(/^'|'$/g, ''));
}

function parseAllCsv(lines: string[], startIndex: number): ProcessedLogEntry[] {
  const dataLines = lines.filter((l) => !l.startsWith('#'));
  if (dataLines.length === 0) return [];

  const firstLine = dataLines[0];
  const separator = firstLine.includes('\t') ? '\t' : ',';
  let headers: string[] = [];

  const headerLine = lines.find((l) => l.startsWith('#Fields:'));
  if (headerLine) {
    headers = headerLine.replace('#Fields:', '').trim().split(/\s+/);
  } else {
    headers = parseCSVLine(firstLine, separator);
  }

  const findIdx = (keyParts: string[]) =>
    headers.findIndex((h) => keyParts.some((k) => h.toLowerCase().includes(k)));

  const idxStatus = findIdx(['status', 'sc-status']);
  const idxMethod = findIdx(['method', 'cs-method']);
  const idxPath = findIdx(['uri', 'path', 'cs-uri-stem']);
  const idxTime = findIdx(['time', 'timestamp', 'date']);
  const idxLatency = findIdx(['time-taken', 'latency', 'duration']);

  return dataLines
    .slice(headerLine ? 0 : 1)
    .map((line, i) => {
      const cells = parseCSVLine(line, separator);
      if (cells.length < headers.length * 0.5) return null;

      const method = cells[idxMethod] || 'MSG';
      const rawPath = cells[idxPath] || '-';
      const normalized = normalizePath(`${method} ${rawPath}`);

      const status = parseInt(cells[idxStatus] || '0', 10);
      const latency = parseFloat(cells[idxLatency] || '0');
      const finalLatency = headers.includes('time-taken') ? latency * 1000 : latency;

      let timestamp = new Date().toISOString();
      if (idxTime !== -1 && cells[idxTime]) {
        const idxDate = headers.indexOf('date');
        if (idxDate !== -1 && idxDate !== idxTime) {
          timestamp = parseDate(`${cells[idxDate]} ${cells[idxTime]}`);
        } else {
          timestamp = parseDate(cells[idxTime]);
        }
      }

      return {
        id: makeLogId(line, startIndex + i),
        timestamp,
        originalTimestamp: cells[idxTime] || '',
        method: normalized.method,
        path: normalized.path,
        fullRequest: `${method} ${rawPath}`,
        status: isNaN(status) ? 0 : status,
        latency: isNaN(finalLatency) ? 0 : finalLatency,
        upstreamLatency: 0,
        userAgent: '-',
        remoteIp: '-',
        referer: '-',
        isError: status >= 400,
        severity: determineSeverity(status, rawPath),
        logType: 'HTTP' as const,
        bodyBytes: 0,
        rawLine: line,
        metadata: { source: 'CSV/TSV' },
      };
    })
    .filter(Boolean) as ProcessedLogEntry[];
}

export const csvParser: LogParser = {
  id: 'csv',
  exclusive: true,
  detect: (sample) => {
    if (sample[0]?.trim().startsWith('{')) return 0;
    if (sample.some((l) => l.startsWith('#Fields:'))) return 1;
    if (sample[0]?.includes('\t')) return 0.9;
    if (sample[0]?.includes(',') && /status/i.test(sample[0])) return 0.8;
    return 0;
  },
  parse: () => null,
  parseAll: parseAllCsv,
};
