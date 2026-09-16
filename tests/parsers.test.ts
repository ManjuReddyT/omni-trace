import { describe, expect, it } from 'vitest';
import { parseLogs } from '../utils';

function parseOne(content: string) {
  const logs = parseLogs(content);
  expect(logs.length).toBeGreaterThan(0);
  return logs[0];
}

describe('JSON / GCP', () => {
  it('happy: GCP load balancer JSON', () => {
    const log = parseOne(
      `{"httpRequest":{"requestMethod":"GET","requestUrl":"https://api.example.com/users/123","status":200,"latency":"0.142s","remoteIp":"203.0.113.42"},"timestamp":"2025-01-17T14:32:01.123Z","severity":"INFO"}`
    );
    expect(log.logType).toBe('HTTP');
    expect(log.method).toBe('GET');
    expect(log.status).toBe(200);
    expect(log.latency).toBeCloseTo(142, 0);
    expect(log.isError).toBe(false);
    expect(log.path).toMatch(/users/);
  });

  it('messy: nested jsonPayload, invalid line dropped', () => {
    const logs = parseLogs(`{"jsonPayload":{"request":"POST /orders","status":500},"timestamp":"2025-01-17T14:32:15.456Z","severity":"ERROR"}
this is not json
{"httpRequest":{"requestMethod":"GET","requestUrl":"/health","status":200},"timestamp":"2025-01-17T14:32:18.000Z"}`);
    expect(logs).toHaveLength(2);
    expect(logs[0].status).toBe(500);
    expect(logs[0].isError).toBe(true);
    expect(logs[1].status).toBe(200);
    expect(logs[1].method).toBe('GET');
  });
});

describe('Nginx / Apache CLF', () => {
  it('happy: combined log format', () => {
    const log = parseOne(
      `203.0.113.42 - - [17/Jan/2025:14:32:01 +0000] "GET /api/users/123 HTTP/1.1" 200 1234 "-" "Mozilla/5.0"`
    );
    expect(log.logType).toBe('HTTP');
    expect(log.method).toBe('GET');
    expect(log.status).toBe(200);
    expect(log.path).toBe('/api/users/:id');
    expect(log.remoteIp).toBe('203.0.113.42');
    expect(log.isError).toBe(false);
  });

  it('messy: extra request_time token and 5xx', () => {
    const log = parseOne(
      `198.51.100.23 - - [17/Jan/2025:14:32:15 +0000] "POST /api/orders HTTP/1.1" 500 512 "-" "axios/1.6.0" 2.451`
    );
    expect(log.status).toBe(500);
    expect(log.isError).toBe(true);
    expect(log.severity).toBe('CRITICAL');
    expect(log.latency).toBeCloseTo(2451, 0);
  });
});

describe('AWS ALB', () => {
  it('happy: ALB access line', () => {
    const log = parseOne(
      `2025-01-17T14:32:01.123Z app/load-balancer/123 203.0.113.42:1234 10.0.0.1:80 0.001 0.142 0.001 200 200 345 1234 "GET http://api.example.com:80/api/users/123 HTTP/1.1" "Mozilla/5.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2`
    );
    expect(log.logType).toBe('HTTP');
    expect(log.method).toBe('GET');
    expect(log.status).toBe(200);
    expect(log.metadata.source).toBe('AWS_ALB');
    expect(log.latency).toBeGreaterThan(100);
  });

  it('messy: target processing -1 and 502', () => {
    const log = parseOne(
      `2025-01-17T14:32:01.123Z app/lb/123 203.0.113.42:1234 10.0.0.1:80 0.001 -1 0.001 502 502 345 0 "GET http://api.example.com:80/health HTTP/1.1" "curl/7.68" ECDHE TLSv1.2`
    );
    expect(log.status).toBe(502);
    expect(log.isError).toBe(true);
    expect(Number.isFinite(log.latency)).toBe(true);
    expect(log.latency).toBeGreaterThanOrEqual(0);
  });
});

describe('Envoy', () => {
  it('happy: default access log', () => {
    const log = parseOne(
      `[2025-01-17T14:32:01.123Z] "GET /api/v1/users HTTP/1.1" 200 - 0 1234 10 10 "-" "Mozilla/5.0" "10.0.0.1" "api.example.com"`
    );
    expect(log.logType).toBe('HTTP');
    expect(log.method).toBe('GET');
    expect(log.status).toBe(200);
    expect(log.latency).toBe(10);
    expect(log.metadata.source).toBe('Envoy');
  });

  it('messy: 503 UH upstream failure', () => {
    const log = parseOne(
      `[2025-01-17T14:32:15.456Z] "POST /api/v1/orders HTTP/1.1" 503 UH 512 0 5000 5000 "-" "axios/0.21.1" "10.0.0.2" "api.example.com"`
    );
    expect(log.status).toBe(503);
    expect(log.isError).toBe(true);
    expect(log.latency).toBe(5000);
  });
});

describe('Spring Boot / Java', () => {
  it('happy: HTTP-looking INFO line', () => {
    const log = parseOne(
      `2025-01-17 14:32:01.123  INFO 12345 --- [nio-8080-exec-1] c.e.controller.UserController : Processing GET /api/users request`
    );
    expect(log.logType).toBe('HTTP');
    expect(log.method).toBe('GET');
    expect(log.path).toMatch(/api\/users/);
    expect(log.severity).toBe('INFO');
    expect(log.metadata.source).toBe('Java');
  });

  it('messy: ERROR plus stack-trace fallback line', () => {
    const logs = parseLogs(`2025-01-17 14:32:25.567 ERROR 12345 --- [nio-8080-exec-3] c.e.handler.GlobalExceptionHandler : Exception occurred while processing request
	at com.example.service.OrderService.process(OrderService.java:45)`);
    expect(logs).toHaveLength(2);
    expect(logs[0].severity).toBe('ERROR');
    expect(logs[0].isError).toBe(true);
    expect(logs[1].logType).toBe('UNKNOWN');
  });
});

describe('MongoDB', () => {
  it('happy: COMMAND with duration', () => {
    const log = parseOne(
      `2025-01-17T14:32:01.123+0000 I COMMAND  [conn123] command db.users command: find { filter: { name: "Alice" } } protocol:op_msg 123ms`
    );
    expect(log.logType).toBe('DATABASE');
    expect(log.method).toBe('FIND');
    expect(log.latency).toBe(123);
    expect(log.severity).toBe('INFO');
    expect(log.metadata.source).toBe('MongoDB');
  });

  it('messy: error with no duration', () => {
    const log = parseOne(
      `2025-01-17T14:32:25.567+0000 E STORAGE  [conn126] WiredTiger error (24) read checksum error`
    );
    expect(log.logType).toBe('DATABASE');
    expect(log.severity).toBe('ERROR');
    expect(log.isError).toBe(true);
    expect(log.latency).toBe(0);
  });
});

describe('Redis', () => {
  it('happy: master info line', () => {
    const log = parseOne(
      `1234:M 17 Jan 2025 14:32:01.123 * Background saving started by pid 5678`
    );
    expect(log.logType).toBe('DATABASE');
    expect(log.method).toBe('REDIS');
    expect(log.severity).toBe('INFO');
    expect(log.metadata.source).toBe('Redis');
  });

  it('messy: security warning hash marker', () => {
    const log = parseOne(
      `1234:M 17 Jan 2025 14:32:15.456 # Possible SECURITY ATTACK detected. It looks like somebody is sending POST or Host: commands to Redis.`
    );
    expect(log.logType).toBe('DATABASE');
    expect(log.severity).toBe('WARN');
    expect(log.fullRequest).toMatch(/SECURITY ATTACK/);
  });
});

describe('Syslog', () => {
  it('happy: RFC3164-style line', () => {
    const log = parseOne(
      `<34>Jan 17 14:32:01 webhost nginx: GET /index.html 200`
    );
    expect(log.logType).toBe('SYSTEM');
    expect(log.method).toBe('SYSLOG');
    expect(log.path).toBe('nginx');
    expect(log.status).toBe(200);
    expect(log.isError).toBe(false);
  });

  it('messy: ISO timestamp and error text', () => {
    const log = parseOne(
      `<165>2025-01-17T14:32:01.123Z webhost app[99]: upstream fail error 500`
    );
    expect(log.logType).toBe('SYSTEM');
    expect(log.isError).toBe(true);
    expect(log.status).toBe(500);
    expect(log.metadata.pid).toBe('99');
  });
});

describe('Kubernetes CRI', () => {
  it('happy: stdout info', () => {
    const log = parseOne(
      `2025-01-17T14:32:01.123Z stdout F I0117 14:32:01.123456 1 controller.go:234] Successfully synced web-app`
    );
    expect(log.severity).toBe('INFO');
    expect(log.path).toBe('controller.go');
    expect(log.isError).toBe(false);
  });

  it('messy: stderr error', () => {
    const log = parseOne(
      `2025-01-17T14:32:15.456Z stderr F E0117 14:32:15.456789 1 reflector.go:178] Failed to watch Pod: connection refused`
    );
    expect(log.severity).toBe('ERROR');
    expect(log.isError).toBe(true);
    expect(log.path).toBe('reflector.go');
  });
});

describe('PostgreSQL', () => {
  it('happy: SELECT with duration', () => {
    const log = parseOne(
      `2025-01-17 14:32:01.123 UTC [1234] user@webapp LOG: duration: 142.456 ms statement: SELECT * FROM users`
    );
    expect(log.logType).toBe('DATABASE');
    expect(log.method).toBe('SELECT');
    expect(log.path).toBe('users');
    expect(log.latency).toBeCloseTo(142.456, 2);
    expect(log.isError).toBe(false);
  });

  it('messy: ERROR with no duration', () => {
    const log = parseOne(
      `2025-01-17 14:32:15.456 UTC [1235] user@webapp ERROR: deadlock detected`
    );
    expect(log.logType).toBe('DATABASE');
    expect(log.severity).toBe('ERROR');
    expect(log.isError).toBe(true);
    expect(log.latency).toBe(0);
  });
});

describe('CloudFront TSV', () => {
  const fields =
    '#Fields: date time x-edge-location sc-bytes c-ip cs-method cs(Host) cs-uri-stem sc-status cs(Referer) cs(User-Agent) cs-uri-query cs(Cookie) x-edge-result-type x-edge-request-id x-host-header cs-protocol cs-bytes time-taken x-forwarded-for ssl-protocol ssl-cipher x-edge-response-result-type cs-protocol-version fle-status fle-encrypted-fields c-port time-to-first-byte x-edge-detailed-result-type sc-content-type sc-content-len sc-range-start sc-range-end';
  const row =
    '2025-01-17\t14:32:01\tSFO53-P1\t1234\t203.0.113.42\tGET\td123.cloudfront.net\t/api/users\t200\t-\tMozilla/5.0\t-\t-\tHit\tAbC123==\texample.com\thttps\t345\t0.142\t-\tTLSv1.2\tECDHE-RSA-AES128-GCM-SHA256\tHit\tHTTP/2.0\t-\t-\t12345\t0.140\tHit\tapplication/json\t1234\t-\t-';

  it('happy: W3C #Fields header', () => {
    const log = parseOne(`${fields}\n${row}`);
    expect(log.logType).toBe('HTTP');
    expect(log.method).toBe('GET');
    expect(log.status).toBe(200);
    expect(log.path).toMatch(/api\/users/);
    expect(log.latency).toBeCloseTo(142, 0);
  });

  it('messy: Version comment before Fields', () => {
    const logs = parseLogs(`#Version: 1.0\n${fields}\n${row}`);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].status).toBe(200);
    expect(logs[0].method).toBe('GET');
  });
});
