import { LogCluster, LogSeverity, ProcessedLogEntry } from '../types';
import { makeLogId } from './id';

const WILDCARD = '<*>';
const SIMILARITY = 0.5;
const PREFIX_DEPTH = 1;

export function generateLogTemplate(message: string): string {
  return tokenize(message).join(' ').substring(0, 150);
}

function tokenize(message: string): string[] {
  return message.trim().split(/\s+/).filter(Boolean).slice(0, 40);
}

function prefixToken(token: string): string {
  if (/^\d+(\.\d+)?$/.test(token)) return WILDCARD;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return WILDCARD;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(token)) return WILDCARD;
  return token;
}

function similarity(a: string[], b: string[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i] || a[i] === WILDCARD || b[i] === WILDCARD) same++;
  }
  return same / a.length;
}

function mergeTokens(a: string[], b: string[]): string[] {
  return a.map((t, i) => (t === b[i] ? t : WILDCARD));
}

interface DrainCluster {
  tokens: string[];
  count: number;
  errorCount: number;
  latencySum: number;
  sample: string;
  severity: LogSeverity;
}

/**
 * Simplified Drain: group by token length, then a short prefix, then similarity.
 * Differing tokens become `<*>` so `/users/1` and `/users/2` share a template.
 */
export function clusterLogs(logs: ProcessedLogEntry[]): LogCluster[] {
  const groups = new Map<string, DrainCluster[]>();

  for (const log of logs) {
    const tokens = tokenize(log.fullRequest);
    if (tokens.length === 0) continue;

    const prefix = tokens.slice(0, PREFIX_DEPTH).map(prefixToken).join(' ');
    const key = `${tokens.length}|${prefix}`;
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }

    let matched: DrainCluster | null = null;
    for (const cluster of list) {
      if (similarity(cluster.tokens, tokens) >= SIMILARITY) {
        matched = cluster;
        break;
      }
    }

    if (matched) {
      matched.tokens = mergeTokens(matched.tokens, tokens);
      matched.count++;
      if (log.isError) matched.errorCount++;
      matched.latencySum += log.latency;
      if (log.severity === 'CRITICAL' || (log.severity === 'ERROR' && matched.severity === 'INFO')) {
        matched.severity = log.severity;
      }
    } else {
      list.push({
        tokens: [...tokens],
        count: 1,
        errorCount: log.isError ? 1 : 0,
        latencySum: log.latency,
        sample: log.fullRequest,
        severity: log.severity,
      });
    }
  }

  return [...groups.values()]
    .flat()
    .map((c) => {
      const template = c.tokens.join(' ').substring(0, 150);
      return {
        id: makeLogId(template, 0),
        template,
        sample: c.sample,
        count: c.count,
        errorCount: c.errorCount,
        avgLatency: c.latencySum / c.count,
        severity: c.severity,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}
