import { LogSeverity } from '../types';

export function normalizePath(requestStr: string): { method: string; path: string } {
  if (!requestStr || typeof requestStr !== 'string' || requestStr === '-') {
    return { method: 'UNKNOWN', path: 'UNKNOWN' };
  }

  const parts = requestStr.split(' ');
  const method = parts.length > 0 && /^[A-Z]+$/.test(parts[0]) ? parts[0] : 'MSG';
  let rawPath = parts.length > 1 ? parts[1] : parts[0];

  let path = rawPath.split('?')[0];
  path = path.replace(/\/([0-9a-fA-F-]{32,}|[0-9a-fA-F-]{36})(\/|$)/g, '/:uuid$2');
  path = path.replace(/\/(\d+)(\/|$)/g, '/:id$2');

  return { method, path };
}

export function getField(obj: any, keys: string[]): any {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];

    const parts = key.split('.');
    if (parts.length > 1) {
      let val = obj;
      let found = true;
      for (const p of parts) {
        if (val && typeof val === 'object' && p in val) {
          val = val[p];
        } else {
          found = false;
          break;
        }
      }
      if (found && val !== undefined) return val;
    }
  }
  return undefined;
}

export function parseDate(rawTime: string | number): string {
  if (!rawTime) return new Date().toISOString();

  if (typeof rawTime === 'number') {
    if (rawTime < 10000000000) return new Date(rawTime * 1000).toISOString();
    return new Date(rawTime).toISOString();
  }

  const timeStr = String(rawTime);

  if (timeStr.includes(':') && timeStr.includes('/')) {
    const parts = timeStr.split(/:| /);
    if (parts.length >= 4) {
      const dateStr = timeStr.replace(':', ' ');
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  const d = new Date(timeStr);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

export function determineSeverity(status: number, message: string): LogSeverity {
  if (status >= 500) return 'CRITICAL';
  if (status >= 400) return 'ERROR';
  if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) return 'ERROR';
  if (message.toLowerCase().includes('warn')) return 'WARN';
  return 'INFO';
}

export function matchFraction(sample: string[], test: (line: string) => boolean): number {
  if (sample.length === 0) return 0;
  return sample.filter(test).length / sample.length;
}
