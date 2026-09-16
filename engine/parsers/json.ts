import { ProcessedLogEntry, LogSeverity } from '../../types';
import { determineSeverity, getField, normalizePath, parseDate, matchFraction } from '../helpers';
import { makeLogId } from '../id';
import { LogParser } from './types';

function parseJsonLine(line: string, index: number): ProcessedLogEntry | null {
  try {
    if (!line.trim()) return null;
    const json = JSON.parse(line);

    let fullRequest = getField(json, ['request', 'jsonPayload.request', 'message', 'msg']);
    let method = getField(json, ['httpRequest.requestMethod', 'method']);
    let url = getField(json, ['httpRequest.requestUrl', 'url', 'path']);

    if (!fullRequest && method && url) {
      fullRequest = `${method} ${url}`;
    }

    fullRequest = fullRequest ? String(fullRequest) : '-';

    const normalized = normalizePath(fullRequest);
    if (method) normalized.method = String(method);

    const status = parseInt(getField(json, ['status', 'jsonPayload.status', 'statusCode', 'code', 'httpRequest.status']) || '0', 10);

    let latency = 0;
    const latencyRaw = getField(json, ['request_time', 'jsonPayload.request_time', 'latency', 'duration', 'httpRequest.latency']);

    if (typeof latencyRaw === 'string' && latencyRaw.endsWith('s')) {
      latency = parseFloat(latencyRaw) * 1000;
    } else {
      latency = parseFloat(latencyRaw || '0');
    }

    const upstreamLat = parseFloat(getField(json, ['upstream_response_time', 'jsonPayload.upstream_response_time']) || '0');
    const rawTime = getField(json, ['time_local', 'jsonPayload.time_local', 'timestamp', 'time', 'ts']) || '';

    const rawSeverity = getField(json, ['severity', 'level']);
    const severityStr = rawSeverity ? String(rawSeverity).toUpperCase() : '';
    let severity: LogSeverity = (severityStr as LogSeverity) || determineSeverity(status, fullRequest);
    if (severityStr === 'WARNING') severity = 'WARN';

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(rawTime),
      originalTimestamp: String(rawTime),
      method: normalized.method,
      path: normalized.path,
      fullRequest,
      status: isNaN(status) ? 0 : status,
      latency: isNaN(latency) ? 0 : latency,
      upstreamLatency: upstreamLat,
      userAgent: String(getField(json, ['http_user_agent', 'jsonPayload.http_user_agent', 'userAgent', 'httpRequest.userAgent']) || '-'),
      remoteIp: String(getField(json, ['remote_addr', 'jsonPayload.remote_addr', 'clientIp', 'httpRequest.remoteIp']) || '-'),
      referer: String(getField(json, ['http_referer', 'jsonPayload.http_referer', 'referer', 'httpRequest.referer']) || '-'),
      isError: status >= 400 || severity === 'ERROR' || severity === 'CRITICAL',
      severity,
      logType: url || method || status > 0 ? 'HTTP' : 'APP',
      bodyBytes: parseInt(getField(json, ['body_bytes_sent', 'jsonPayload.body_bytes_sent', 'size', 'httpRequest.responseSize']) || '0', 10),
      rawLine: line,
      metadata: json,
    };
  } catch {
    return null;
  }
}

export const jsonParser: LogParser = {
  id: 'json',
  exclusive: true,
  detect: (sample) => {
    if (sample[0]?.trim().startsWith('{')) return 1;
    return matchFraction(sample, (l) => l.trim().startsWith('{'));
  },
  parse: parseJsonLine,
  parseAll: (lines, startIndex) =>
    lines
      .map((line, i) => parseJsonLine(line, startIndex + i))
      .filter(Boolean) as ProcessedLogEntry[],
};
