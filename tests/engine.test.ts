import { describe, expect, it } from 'vitest';
import { detectFormat, makeLogId, parseLogs } from '../engine';

describe('parser registry', () => {
  it('detects JSON lines', () => {
    const detected = detectFormat([
      '{"status":200,"message":"ok"}',
      '{"status":500,"message":"fail"}',
    ]);
    expect(detected?.id).toBe('json');
    expect(detected!.score).toBeGreaterThanOrEqual(0.6);
  });

  it('detects CloudFront #Fields as csv', () => {
    const detected = detectFormat([
      '#Version: 1.0',
      '#Fields: date time cs-method cs-uri-stem sc-status',
      '2025-01-17\t14:32:01\tGET\t/api\t200',
    ]);
    expect(detected?.id).toBe('csv');
  });

  it('detects Nginx CLF', () => {
    const detected = detectFormat([
      '203.0.113.42 - - [17/Jan/2025:14:32:01 +0000] "GET /api/users/123 HTTP/1.1" 200 1234 "-" "Mozilla/5.0"',
    ]);
    expect(detected?.id).toBe('clf');
  });
});

describe('stable ids', () => {
  it('is deterministic for the same line and index', () => {
    expect(makeLogId('GET /x', 3)).toBe(makeLogId('GET /x', 3));
  });

  it('changes when the index changes (append-safe)', () => {
    const line = '203.0.113.42 - - [17/Jan/2025:14:32:01 +0000] "GET /api HTTP/1.1" 200 1 "-" "-"';
    const first = parseLogs(line, { startIndex: 0 })[0].id;
    const appended = parseLogs(line, { startIndex: 500 })[0].id;
    expect(first).not.toBe(appended);
  });

  it('does not collide across two parsed chunks of the same file', () => {
    const a = parseLogs('{"status":200,"httpRequest":{"requestMethod":"GET","requestUrl":"/a"}}', { startIndex: 0 });
    const b = parseLogs('{"status":201,"httpRequest":{"requestMethod":"GET","requestUrl":"/b"}}', { startIndex: 1 });
    expect(a[0].id).not.toBe(b[0].id);
  });
});
