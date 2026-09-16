import { ProcessedLogEntry, LogSeverity } from '../../types';
import { determineSeverity, matchFraction, normalizePath, parseDate } from '../helpers';
import { makeLogId } from '../id';
import { LogParser } from './types';

const CLF_REGEX = /^(\S+) - (\S+) \[([\w:/]+\s[+\-]\d{4})\] "(\S+) (\S+)\s*(\S+)?" (\d{3}) (\d+)( "([^"]*)")?( "([^"]*)")?/;
const K8S_REGEX = /^(\S+) (stdout|stderr) F (.*)$/;
const PG_REGEX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?) (\w+) \[(\d+)\] (\S+) (\w+): (.*)$/;
const AWS_ALB_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z) \S+ \S+ \S+ ([0-9.-]+) ([0-9.-]+) ([0-9.-]+) (\d{3}) (\d{3}) \d+ \d+ "([^"]+)" "([^"]+)"/;
const SYSLOG_REGEX = /^<(\d+)>([A-Z][a-z]{2}\s+\d+\s\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(\S+)\s+([^:\[]+)(?:\[(\d+)\])?:?\s+(.*)$/;
const MONGO_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{4})\s+(\w+)\s+(\w+)\s+\[(.*?)\]\s+(.*)$/;
const REDIS_REGEX = /^(\d+:[MS])\s+(\d{2}\s+\w+\s+\d{4}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+([.*#])\s+(.*)$/;
const JAVA_REGEX = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\w+)\s+(\d+)\s+---\s+\[(.*?)\]\s+(.*?)\s+:\s+(.*)$/;
const ENVOY_REGEX = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\] "(\S+) (\S+) \S+" (\d{3}) \S+ (\d+) (\d+) (\d+) (\d+) ".*?" "(.*?)" "(.*?)"/;

function byRegex(re: RegExp): (sample: string[]) => number {
  return (sample) => matchFraction(sample, (l) => re.test(l));
}

export const clfParser: LogParser = {
  id: 'clf',
  detect: byRegex(CLF_REGEX),
  parse(line, index) {
    const match = line.match(CLF_REGEX);
    if (!match) return null;
    const [, remoteIp, , rawTime, method, rawPath, , statusStr, bytesStr, , referer, , userAgent] = match;
    const status = parseInt(statusStr, 10);
    const path = rawPath.split('?')[0];
    const normalizedPath = path.replace(/\/(\d+)(\/|$)/g, '/:id$2');

    const parts = line.split(' ');
    let latency = 0;
    const lastPart = parts[parts.length - 1];
    if (!isNaN(parseFloat(lastPart)) && lastPart.includes('.')) {
      latency = parseFloat(lastPart);
      if (latency < 100) latency = latency * 1000;
    }

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(rawTime),
      originalTimestamp: rawTime,
      method,
      path: normalizedPath,
      fullRequest: `${method} ${rawPath}`,
      status,
      latency,
      upstreamLatency: 0,
      userAgent: userAgent || '-',
      remoteIp,
      referer: referer || '-',
      isError: status >= 400,
      severity: determineSeverity(status, ''),
      logType: 'HTTP',
      bodyBytes: parseInt(bytesStr, 10),
      rawLine: line,
      metadata: {},
    };
  },
};

export const albParser: LogParser = {
  id: 'alb',
  detect: byRegex(AWS_ALB_REGEX),
  parse(line, index) {
    const match = line.match(AWS_ALB_REGEX);
    if (!match) return null;
    const [, timestamp, reqProc, targetProc, resProc, elbStatus, targetStatus, requestLine, userAgent] = match;
    const reqParts = requestLine.split(' ');
    const method = reqParts[0];
    const normalized = normalizePath(requestLine);
    const tProc = parseFloat(targetProc);
    const totalLatency = (parseFloat(reqProc) + (tProc === -1 ? 0 : tProc) + parseFloat(resProc)) * 1000;
    const status = parseInt(targetStatus, 10);

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method,
      path: normalized.path,
      fullRequest: requestLine,
      status,
      latency: totalLatency,
      upstreamLatency: tProc * 1000,
      userAgent,
      remoteIp: '-',
      referer: '-',
      isError: status >= 400 || parseInt(elbStatus) >= 400,
      severity: determineSeverity(status, ''),
      logType: 'HTTP',
      bodyBytes: 0,
      rawLine: line,
      metadata: { source: 'AWS_ALB', elbStatus },
    };
  },
};

export const envoyParser: LogParser = {
  id: 'envoy',
  detect: byRegex(ENVOY_REGEX),
  parse(line, index) {
    const match = line.match(ENVOY_REGEX);
    if (!match) return null;
    const [, timestamp, method, rawPath, statusStr, bytesSent, , duration, upstreamTime, userAgent, requestId] = match;
    const status = parseInt(statusStr, 10);
    const normalized = normalizePath(`${method} ${rawPath}`);

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method,
      path: normalized.path,
      fullRequest: `${method} ${rawPath}`,
      status,
      latency: parseInt(duration, 10),
      upstreamLatency: parseInt(upstreamTime, 10) || 0,
      userAgent: userAgent || '-',
      remoteIp: '-',
      referer: '-',
      isError: status >= 400,
      severity: determineSeverity(status, ''),
      logType: 'HTTP',
      bodyBytes: parseInt(bytesSent, 10),
      rawLine: line,
      metadata: { source: 'Envoy', requestId },
    };
  },
};

export const javaParser: LogParser = {
  id: 'java',
  detect: byRegex(JAVA_REGEX),
  parse(line, index) {
    const match = line.match(JAVA_REGEX);
    if (!match) return null;
    const [, timestamp, level, pid, thread, logger, message] = match;
    const severity: LogSeverity = ['ERROR', 'FATAL'].includes(level) ? 'ERROR' : level === 'WARN' ? 'WARN' : 'INFO';
    const httpMatch = message.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\S+)/);
    const method = httpMatch ? httpMatch[1] : 'LOG';
    const path = httpMatch ? httpMatch[2] : logger.split('.').pop() || 'App';
    const normalized = normalizePath(`${method} ${path}`);

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method,
      path: normalized.path,
      fullRequest: message,
      status: 0,
      latency: 0,
      upstreamLatency: 0,
      userAgent: '-',
      remoteIp: '-',
      referer: '-',
      isError: severity === 'ERROR',
      severity,
      logType: httpMatch ? 'HTTP' : 'APP',
      bodyBytes: 0,
      rawLine: line,
      metadata: { source: 'Java', thread, pid, logger },
    };
  },
};

export const mongoParser: LogParser = {
  id: 'mongo',
  detect: byRegex(MONGO_REGEX),
  parse(line, index) {
    const match = line.match(MONGO_REGEX);
    if (!match) return null;
    const [, timestamp, severityChar, component, context, message] = match;
    const severityMap: Record<string, LogSeverity> = { I: 'INFO', W: 'WARN', E: 'ERROR', F: 'CRITICAL' };
    const severity = severityMap[severityChar] || 'INFO';
    let latency = 0;
    const durMatch = message.match(/(\d+)ms$/);
    if (durMatch) latency = parseInt(durMatch[1], 10);
    const cmdMatch = message.match(/command: (\w+)/);
    const method = cmdMatch ? cmdMatch[1].toUpperCase() : 'MONGO';

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method,
      path: component,
      fullRequest: message,
      status: 0,
      latency,
      upstreamLatency: 0,
      userAgent: '-',
      remoteIp: '-',
      referer: '-',
      isError: severity === 'ERROR' || severity === 'CRITICAL',
      severity,
      logType: 'DATABASE',
      bodyBytes: 0,
      rawLine: line,
      metadata: { source: 'MongoDB', context, component },
    };
  },
};

export const redisParser: LogParser = {
  id: 'redis',
  detect: byRegex(REDIS_REGEX),
  parse(line, index) {
    const match = line.match(REDIS_REGEX);
    if (!match) return null;
    const [, role, timestamp, char, message] = match;
    const severity: LogSeverity = char === '#' ? 'WARN' : 'INFO';

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method: 'REDIS',
      path: 'server',
      fullRequest: message,
      status: 0,
      latency: 0,
      upstreamLatency: 0,
      userAgent: '-',
      remoteIp: '-',
      referer: '-',
      isError: false,
      severity,
      logType: 'DATABASE',
      bodyBytes: 0,
      rawLine: line,
      metadata: { source: 'Redis', role },
    };
  },
};

export const syslogParser: LogParser = {
  id: 'syslog',
  detect: byRegex(SYSLOG_REGEX),
  parse(line, index) {
    const match = line.match(SYSLOG_REGEX);
    if (!match) return null;
    const [, pri, timestamp, host, appName, pid, message] = match;
    const statusMatch = message.match(/\s(\d{3})(?:\s|$)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    const isErr = status >= 400 || message.toLowerCase().includes('error') || message.toLowerCase().includes('fail');

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method: 'SYSLOG',
      path: appName,
      fullRequest: message,
      status,
      latency: 0,
      upstreamLatency: 0,
      userAgent: '-',
      remoteIp: host,
      referer: '-',
      isError: isErr,
      severity: isErr ? 'ERROR' : 'INFO',
      logType: 'SYSTEM',
      bodyBytes: 0,
      rawLine: line,
      metadata: { pid, pri },
    };
  },
};

export const k8sParser: LogParser = {
  id: 'k8s',
  detect: byRegex(K8S_REGEX),
  parse(line, index) {
    const match = line.match(K8S_REGEX);
    if (!match) return null;
    const [, timestamp, stream, content] = match;
    let severity: LogSeverity = 'INFO';
    if (stream === 'stderr' || content.includes(' E') || content.startsWith('E')) severity = 'ERROR';
    else if (content.includes(' W') || content.startsWith('W')) severity = 'WARN';

    const statusMatch = content.match(/ (\d{3}) /);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    const latMatch = content.match(/ (\d+)ms/);
    const latency = latMatch ? parseInt(latMatch[1], 10) : 0;
    const componentMatch = content.match(/ (\S+\.go)/);

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method: 'LOG',
      path: componentMatch ? componentMatch[1] : 'k8s-pod',
      fullRequest: content,
      status,
      latency,
      upstreamLatency: 0,
      userAgent: '-',
      remoteIp: '-',
      referer: '-',
      isError: severity === 'ERROR',
      severity,
      logType: status > 0 ? 'HTTP' : 'APP',
      bodyBytes: 0,
      rawLine: line,
      metadata: { stream },
    };
  },
};

export const postgresParser: LogParser = {
  id: 'postgres',
  detect: byRegex(PG_REGEX),
  parse(line, index) {
    const match = line.match(PG_REGEX);
    if (!match) return null;
    const [, timestamp, tz, pid, user, level, message] = match;
    let latency = 0;
    const durMatch = message.match(/duration: ([\d.]+) ms/);
    if (durMatch) latency = parseFloat(durMatch[1]);

    const severity: LogSeverity =
      ['ERROR', 'FATAL', 'PANIC'].includes(level) ? 'ERROR' : level === 'WARNING' ? 'WARN' : 'INFO';

    let method = 'SQL';
    let path = 'query';
    const stmtMatch = message.match(/statement: (\w+)(?:.*?FROM (\w+))?/i);
    if (stmtMatch) {
      method = stmtMatch[1].toUpperCase();
      if (stmtMatch[2]) path = stmtMatch[2];
      else if (method === 'SELECT') path = 'unknown_table';
    }

    return {
      id: makeLogId(line, index),
      timestamp: parseDate(timestamp),
      originalTimestamp: timestamp,
      method,
      path,
      fullRequest: message,
      status: 0,
      latency,
      upstreamLatency: 0,
      userAgent: `Postgres ${pid}`,
      remoteIp: '-',
      referer: '-',
      isError: severity === 'ERROR',
      severity,
      logType: 'DATABASE',
      bodyBytes: 0,
      rawLine: line,
      metadata: { pid, user, timezone: tz },
    };
  },
};

export const genericParser: LogParser = {
  id: 'generic',
  detect: () => 0,
  parse(line, index): ProcessedLogEntry {
    return {
      id: makeLogId(line, index),
      timestamp: new Date().toISOString(),
      originalTimestamp: '',
      method: 'MSG',
      path: 'raw_log',
      fullRequest: line.substring(0, 100),
      status: 0,
      latency: 0,
      upstreamLatency: 0,
      userAgent: '-',
      remoteIp: '-',
      referer: '-',
      isError: false,
      severity: 'INFO',
      logType: 'UNKNOWN',
      bodyBytes: 0,
      rawLine: line,
      metadata: {},
    };
  },
};

/** Cascade order matches the original regex ladder. */
export const TEXT_PARSERS: LogParser[] = [
  clfParser,
  albParser,
  envoyParser,
  javaParser,
  mongoParser,
  redisParser,
  syslogParser,
  k8sParser,
  postgresParser,
];
