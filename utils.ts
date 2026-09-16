import { ProcessedLogEntry, AggregatedStats, LogCluster, LogSeverity } from './types';

// Helper to calculate percentile
const calculatePercentile = (data: number[], percentile: number) => {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
};

// --- URL & Pattern Normalization ---

const normalizePath = (requestStr: string): { method: string; path: string } => {
  if (!requestStr || typeof requestStr !== 'string' || requestStr === '-') return { method: 'UNKNOWN', path: 'UNKNOWN' };
  
  const parts = requestStr.split(' ');
  const method = parts.length > 0 && /^[A-Z]+$/.test(parts[0]) ? parts[0] : 'MSG';
  let rawPath = parts.length > 1 ? parts[1] : parts[0];

  // 1. Remove Query Parameters
  let path = rawPath.split('?')[0];

  // 2. Normalize IDs and UUIDs
  path = path.replace(/\/([0-9a-fA-F-]{32,}|[0-9a-fA-F-]{36})(\/|$)/g, '/:uuid$2'); // UUID
  path = path.replace(/\/(\d+)(\/|$)/g, '/:id$2'); // Numeric ID

  return { method, path };
};

// Generate a "template" from a raw message to group similar logs
const generateLogTemplate = (message: string): string => {
    // Replace standard variable parts with placeholders
    let template = message
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TIMESTAMP>') // ISO Dates
        .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '<IP>') // IPs
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>') // UUIDs
        .replace(/=\d+/g, '=<NUM>') // Query params numbers
        .replace(/:\d+/g, ':<NUM>') // JSON numbers
        .replace(/"[^"]{20,}"/g, '"<STR>"'); // Long strings
    
    // Truncate to avoid massive keys
    return template.substring(0, 150);
};

// --- Parsing Logic ---

const getField = (obj: any, keys: string[]): any => {
    for (const key of keys) {
        // Direct access
        if (obj[key] !== undefined) return obj[key];
        
        // Nested access (e.g., jsonPayload.status)
        const parts = key.split('.');
        if (parts.length > 1) {
            let val = obj;
            let found = true;
            for(const p of parts) {
                if(val && typeof val === 'object' && p in val) {
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
};

const parseDate = (rawTime: string | number): string => {
    if (!rawTime) return new Date().toISOString();
    
    // Handle unix timestamp (numbers)
    if (typeof rawTime === 'number') {
        // Check if seconds (likely < 10 billion) or ms
        if (rawTime < 10000000000) return new Date(rawTime * 1000).toISOString();
        return new Date(rawTime).toISOString();
    }

    // Ensure rawTime is a string to avoid crashes if numbers are passed
    const timeStr = String(rawTime);
    
    // Nginx default format: DD/Mon/YYYY:HH:MM:SS Z
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
};

const determineSeverity = (status: number, message: string): LogSeverity => {
    if (status >= 500) return 'CRITICAL';
    if (status >= 400) return 'ERROR';
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) return 'ERROR';
    if (message.toLowerCase().includes('warn')) return 'WARN';
    return 'INFO';
};

const parseJSONLines = (lines: string[]): ProcessedLogEntry[] => {
    return lines.map((line, i) => {
        try {
            if (!line.trim()) return null;
            const json = JSON.parse(line);
            
            // --- Extract Request Info ---
            let fullRequest = getField(json, ['request', 'jsonPayload.request', 'message', 'msg']);
            let method = getField(json, ['httpRequest.requestMethod', 'method']);
            let url = getField(json, ['httpRequest.requestUrl', 'url', 'path']);

            if (!fullRequest && method && url) {
                fullRequest = `${method} ${url}`;
            }
            
            // Ensure fullRequest is a string (cast numbers/objects to string)
            fullRequest = fullRequest ? String(fullRequest) : '-';

            const normalized = normalizePath(fullRequest);
            // If explicit method found, prefer it over regex extraction
            if (method) normalized.method = String(method); 
            
            const status = parseInt(getField(json, ['status', 'jsonPayload.status', 'statusCode', 'code', 'httpRequest.status']) || '0', 10);
            
            // --- Latency Extraction & Normalization ---
            let latency = 0;
            const latencyRaw = getField(json, ['request_time', 'jsonPayload.request_time', 'latency', 'duration', 'httpRequest.latency']);
            
            if (typeof latencyRaw === 'string' && latencyRaw.endsWith('s')) {
                latency = parseFloat(latencyRaw) * 1000;
            } else {
                latency = parseFloat(latencyRaw || '0');
            }

            const upstreamLat = parseFloat(getField(json, ['upstream_response_time', 'jsonPayload.upstream_response_time']) || '0');
            
            // Check commonly used Zap/Go 'ts' field too
            const rawTime = getField(json, ['time_local', 'jsonPayload.time_local', 'timestamp', 'time', 'ts']) || '';
            
            const rawSeverity = getField(json, ['severity', 'level']);
            const severityStr = rawSeverity ? String(rawSeverity).toUpperCase() : '';
            let severity: LogSeverity = severityStr as LogSeverity || determineSeverity(status, fullRequest);
            if (severityStr === 'WARNING') severity = 'WARN'; 

            return {
                id: `log-json-${i}`,
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
                metadata: json
            };
        } catch (e) {
            return null;
        }
    }).filter(Boolean) as ProcessedLogEntry[];
};

// Regex for Common Log Format (Nginx/Apache)
const CLF_REGEX = /^(\S+) - (\S+) \[([\w:/]+\s[+\-]\d{4})\] "(\S+) (\S+)\s*(\S+)?" (\d{3}) (\d+)( "([^"]*)")?( "([^"]*)")?/;

// Regex for Kubernetes (simplified CRI/standard klog format)
const K8S_REGEX = /^(\S+) (stdout|stderr) F (.*)$/;

// Regex for PostgreSQL
const PG_REGEX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?) (\w+) \[(\d+)\] (\S+) (\w+): (.*)$/;

// Regex for AWS ALB / ELB
const AWS_ALB_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z) \S+ \S+ \S+ ([0-9.-]+) ([0-9.-]+) ([0-9.-]+) (\d{3}) (\d{3}) \d+ \d+ "([^"]+)" "([^"]+)"/;

// Regex for Syslog (RFC 3164/5424 simplified)
const SYSLOG_REGEX = /^<(\d+)>([A-Z][a-z]{2}\s+\d+\s\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(\S+)\s+([^:\[]+)(?:\[(\d+)\])?:?\s+(.*)$/;

// Regex for MongoDB
// 2025-01-17T14:32:01.123+0000 I COMMAND  [conn123] ...
const MONGO_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{4})\s+(\w+)\s+(\w+)\s+\[(.*?)\]\s+(.*)$/;

// Regex for Redis
// 1234:M 17 Jan 2025 14:32:01.123 * ...
const REDIS_REGEX = /^(\d+:[MS])\s+(\d{2}\s+\w+\s+\d{4}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+([.*#])\s+(.*)$/;

// Regex for Spring Boot / Java Simple Format
// 2025-01-17 14:32:01.123  INFO 12345 --- [nio-8080-exec-1] c.e.controller.UserController : Message
const JAVA_REGEX = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\w+)\s+(\d+)\s+---\s+\[(.*?)\]\s+(.*?)\s+:\s+(.*)$/;

// Regex for Envoy Access Logs (Default format)
// [2025-01-17T14:32:01.123Z] "GET /path HTTP/1.1" 200 - 0 123 10 10 "-" "UA" "ID" "HOST" ...
const ENVOY_REGEX = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\] "(\S+) (\S+) \S+" (\d{3}) \S+ (\d+) (\d+) (\d+) (\d+) ".*?" "(.*?)" "(.*?)"/;


const parseRawText = (lines: string[]): ProcessedLogEntry[] => {
    return lines.map((line, i) => {
        if (!line.trim()) return null;

        // 1. CLF/Combined (Nginx/Apache)
        let match = line.match(CLF_REGEX);
        if (match) {
            const [, remoteIp, , rawTime, method, rawPath, , statusStr, bytesStr, , referer, , userAgent] = match;
            const status = parseInt(statusStr, 10);
            const path = rawPath.split('?')[0]; 
            const normalizedPath = path.replace(/\/(\d+)(\/|$)/g, '/:id$2');

            const parts = line.split(' ');
            let latency = 0;
            // Often Nginx configures $request_time at the end
            const lastPart = parts[parts.length - 1];
            if (!isNaN(parseFloat(lastPart)) && lastPart.includes('.')) {
                latency = parseFloat(lastPart);
                if (latency < 100) latency = latency * 1000; // Guessing seconds vs ms
            }

            return {
                id: `log-txt-${i}`,
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
                metadata: {}
            };
        }

        // 2. AWS ALB
        match = line.match(AWS_ALB_REGEX);
        if (match) {
            const [, timestamp, reqProc, targetProc, resProc, elbStatus, targetStatus, requestLine, userAgent] = match;
            const reqParts = requestLine.split(' ');
            const method = reqParts[0];
            const rawPath = reqParts[1] || '';
            const normalized = normalizePath(requestLine);

            const tProc = parseFloat(targetProc);
            const totalLatency = (parseFloat(reqProc) + (tProc === -1 ? 0 : tProc) + parseFloat(resProc)) * 1000; // Seconds to ms

            const status = parseInt(targetStatus, 10);
            
            return {
                id: `log-alb-${i}`,
                timestamp: parseDate(timestamp),
                originalTimestamp: timestamp,
                method,
                path: normalized.path,
                fullRequest: requestLine,
                status,
                latency: totalLatency,
                upstreamLatency: tProc * 1000,
                userAgent,
                remoteIp: '-', // ALB log contains IP in client:port, but regex above simplifies it
                referer: '-',
                isError: status >= 400 || parseInt(elbStatus) >= 400,
                severity: determineSeverity(status, ''),
                logType: 'HTTP',
                bodyBytes: 0,
                rawLine: line,
                metadata: { source: 'AWS_ALB', elbStatus }
            };
        }

        // 3. Envoy Access Logs
        match = line.match(ENVOY_REGEX);
        if (match) {
            const [, timestamp, method, rawPath, statusStr, bytesSent, bytesRecv, duration, upstreamTime, userAgent, requestId] = match;
            const status = parseInt(statusStr, 10);
            const path = rawPath.split('?')[0];
            const normalized = normalizePath(`${method} ${rawPath}`);
            const latency = parseInt(duration, 10); // Envoy usually reports ms or duration string

            return {
                id: `log-envoy-${i}`,
                timestamp: parseDate(timestamp),
                originalTimestamp: timestamp,
                method,
                path: normalized.path,
                fullRequest: `${method} ${rawPath}`,
                status,
                latency,
                upstreamLatency: parseInt(upstreamTime, 10) || 0,
                userAgent: userAgent || '-',
                remoteIp: '-',
                referer: '-',
                isError: status >= 400,
                severity: determineSeverity(status, ''),
                logType: 'HTTP',
                bodyBytes: parseInt(bytesSent, 10),
                rawLine: line,
                metadata: { source: 'Envoy', requestId }
            };
        }

        // 4. Spring Boot / Java
        match = line.match(JAVA_REGEX);
        if (match) {
            const [, timestamp, level, pid, thread, logger, message] = match;
            const severity: LogSeverity = (['ERROR', 'FATAL'].includes(level) ? 'ERROR' : level === 'WARN' ? 'WARN' : 'INFO');
            
            // Try to guess if it's an HTTP log from the message
            const httpMatch = message.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\S+)/);
            const method = httpMatch ? httpMatch[1] : 'LOG';
            const path = httpMatch ? httpMatch[2] : logger.split('.').pop() || 'App';
            const normalized = normalizePath(`${method} ${path}`);
            
            return {
                id: `log-java-${i}`,
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
                metadata: { source: 'Java', thread, pid, logger }
            };
        }

        // 5. MongoDB
        match = line.match(MONGO_REGEX);
        if (match) {
            const [, timestamp, severityChar, component, context, message] = match;
            const severityMap: Record<string, LogSeverity> = {
                'I': 'INFO', 'W': 'WARN', 'E': 'ERROR', 'F': 'CRITICAL'
            };
            const severity = severityMap[severityChar] || 'INFO';
            
            // Try extracting duration
            let latency = 0;
            const durMatch = message.match(/(\d+)ms$/);
            if (durMatch) latency = parseInt(durMatch[1], 10);

            // Extract command type
            const cmdMatch = message.match(/command: (\w+)/);
            const method = cmdMatch ? cmdMatch[1].toUpperCase() : 'MONGO';
            const path = component;

            return {
                id: `log-mongo-${i}`,
                timestamp: parseDate(timestamp),
                originalTimestamp: timestamp,
                method,
                path,
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
                metadata: { source: 'MongoDB', context, component }
            };
        }

        // 6. Redis
        match = line.match(REDIS_REGEX);
        if (match) {
            const [, role, timestamp, char, message] = match;
             const severity: LogSeverity = char === '#' ? 'WARN' : char === '*' ? 'INFO' : 'INFO';
             
             return {
                id: `log-redis-${i}`,
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
                metadata: { source: 'Redis', role }
            };
        }

        // 7. Syslog
        match = line.match(SYSLOG_REGEX);
        if (match) {
             const [, pri, timestamp, host, appName, pid, message] = match;
             const normalized = normalizePath(message);
             
             // Try to extract implicit status code from message
             const statusMatch = message.match(/ (\d{3}) /);
             const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
             const isErr = status >= 400 || message.toLowerCase().includes('error') || message.toLowerCase().includes('fail');
             
             return {
                 id: `log-sys-${i}`,
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
                 metadata: { pid, pri }
             };
        }

        // 8. Kubernetes Pod Logs
        match = line.match(K8S_REGEX);
        if (match) {
            const [, timestamp, stream, content] = match;
            let severity: LogSeverity = 'INFO';
            if (stream === 'stderr' || content.includes(' E') || content.startsWith('E')) severity = 'ERROR';
            else if (content.includes(' W') || content.startsWith('W')) severity = 'WARN';
            
            const statusMatch = content.match(/ (\d{3}) /);
            const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

            const latMatch = content.match(/ (\d+)ms/);
            const latency = latMatch ? parseInt(latMatch[1], 10) : 0;

            const componentMatch = content.match(/ (\S+\.go)/);
            const path = componentMatch ? componentMatch[1] : 'k8s-pod';

            return {
                id: `log-k8s-${i}`,
                timestamp: parseDate(timestamp),
                originalTimestamp: timestamp,
                method: 'LOG',
                path: path,
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
                metadata: { stream }
            };
        }

        // 9. PostgreSQL Logs
        match = line.match(PG_REGEX);
        if (match) {
             const [, timestamp, tz, pid, user, level, message] = match;
             
             let latency = 0;
             const durMatch = message.match(/duration: ([\d.]+) ms/);
             if (durMatch) latency = parseFloat(durMatch[1]);

             const severity: LogSeverity = 
                ['ERROR', 'FATAL', 'PANIC'].includes(level) ? 'ERROR' :
                level === 'WARNING' ? 'WARN' : 'INFO';

             let method = 'SQL';
             let path = 'query';
             const stmtMatch = message.match(/statement: (\w+)(?:.*?FROM (\w+))?/i);
             if (stmtMatch) {
                 method = stmtMatch[1].toUpperCase();
                 if (stmtMatch[2]) path = stmtMatch[2];
                 else if (method === 'SELECT') path = 'unknown_table';
             }

             return {
                id: `log-pg-${i}`,
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
                metadata: { pid, user, timezone: tz }
            };
        }

        // Generic Fallback
        return {
            id: `log-unk-${i}`,
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
            metadata: {}
        };
    }).filter(Boolean) as ProcessedLogEntry[];
};

export const parseLogs = (content: string): ProcessedLogEntry[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Heuristic: If first line looks like JSON
  if (lines[0].trim().startsWith('{')) {
      return parseJSONLines(lines);
  }

  // Fallback to TSV/CSV if header exists
  if (lines[0].includes('\t') || (lines[0].includes(',') && lines[0].includes('status'))) {
      return parseCSV(lines);
  }

  return parseRawText(lines);
};

const parseCSVLine = (line: string, separator: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
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
    return result.map(c => c.trim().replace(/^'|'$/g, ''));
};

const parseCSV = (lines: string[]): ProcessedLogEntry[] => {
    // Basic CSV/TSV parser, attempts to auto-detect header row
    // Skips comment lines (common in CloudFront)
    const dataLines = lines.filter(l => !l.startsWith('#'));
    if (dataLines.length === 0) return [];
    
    const firstLine = dataLines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';
    // CloudFront and others might have headers in a comment line starting with #Fields:
    let headers: string[] = [];
    
    const headerLine = lines.find(l => l.startsWith('#Fields:'));
    if (headerLine) {
        headers = headerLine.replace('#Fields:', '').trim().split(/\s+/);
    } else {
        headers = parseCSVLine(firstLine, separator);
    }

    const findIdx = (keyParts: string[]) => headers.findIndex(h => keyParts.some(k => h.toLowerCase().includes(k)));

    const idxStatus = findIdx(['status', 'sc-status']);
    const idxMethod = findIdx(['method', 'cs-method']);
    const idxPath = findIdx(['uri', 'path', 'cs-uri-stem']);
    const idxTime = findIdx(['time', 'timestamp', 'date']); // CloudFront has Date and Time separate, typically handled by fallback if not perfect
    const idxLatency = findIdx(['time-taken', 'latency', 'duration']); 

    return dataLines.slice(headerLine ? 0 : 1).map((line, i) => {
        const cells = parseCSVLine(line, separator);
        if (cells.length < headers.length * 0.5) return null;

        const method = cells[idxMethod] || 'MSG';
        const rawPath = cells[idxPath] || '-';
        const normalized = normalizePath(`${method} ${rawPath}`);
        
        const status = parseInt(cells[idxStatus] || '0', 10);
        const latency = parseFloat(cells[idxLatency] || '0'); 
        // CloudFront time-taken is in seconds
        const finalLatency = (headers.includes('time-taken')) ? latency * 1000 : latency;
        
        // Simple timestamp reconstruction if separate date/time fields exist
        let timestamp = new Date().toISOString();
        if (idxTime !== -1 && cells[idxTime]) {
            // If CloudFront has date in one col and time in another, this simple parser picks the first match.
            // Enhancing for CloudFront specific:
            const idxDate = headers.indexOf('date');
            if (idxDate !== -1 && idxDate !== idxTime) {
                timestamp = parseDate(`${cells[idxDate]} ${cells[idxTime]}`);
            } else {
                timestamp = parseDate(cells[idxTime]);
            }
        }

        return {
            id: `log-csv-${i}`,
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
            logType: 'HTTP',
            bodyBytes: 0,
            rawLine: line,
            metadata: { source: 'CSV/TSV' }
        };
    }).filter(Boolean) as ProcessedLogEntry[];
};

export const aggregateStats = (logs: ProcessedLogEntry[]): AggregatedStats => {
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
      anomalies: []
    };
  }

  const latencies = logs.map(l => l.latency).sort((a, b) => a - b);
  const totalLatency = latencies.reduce((a, b) => a + b, 0);
  const totalBytes = logs.reduce((a, b) => a + (isNaN(b.bodyBytes) ? 0 : b.bodyBytes), 0);
  const errorCount = logs.filter(l => l.isError).length;

  const statusCounts: Record<string, number> = {};
  logs.forEach(l => {
    let cat = '';
    if (l.logType === 'HTTP') {
      cat = Math.floor(l.status / 100) + 'xx';
    } else {
      cat = l.isError ? 'Error' : 'Success';
    }
    statusCounts[cat] = (statusCounts[cat] || 0) + 1;
  });

  const statusColors: Record<string, string> = {
    '2xx': '#10b981', '3xx': '#3b82f6', '4xx': '#f59e0b', '5xx': '#ef4444', '0xx': '#94a3b8',
    'Success': '#10b981', 'Error': '#ef4444'
  };

  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({
    name, value, fill: statusColors[name] || '#64748b',
  }));

  const endpointMap: Record<string, { count: number; totalLat: number; errors: number }> = {};
  logs.forEach(l => {
    let key = `${l.method} ${l.path}`;
    if (l.logType === 'DATABASE') {
      key = `[DB] ${l.method} ${l.path}`;
    } else if (l.logType === 'SYSTEM') {
      key = `[SYS] ${l.path}`;
    } else if (l.logType === 'APP') {
      key = `[APP] ${l.method} ${l.path}`;
    }
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

  logs.forEach(l => {
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
  logs.forEach(l => { methodCounts[l.method] = (methodCounts[l.method] || 0) + 1; });
  const methodDistribution = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

  const durationSeconds = (maxTime - minTime) / 1000;
  const traffic = durationSeconds > 0 ? totalRequests / durationSeconds : totalRequests; // req/sec
  const p95 = calculatePercentile(latencies, 95);

  // --- Histogram Generation ---
  const histogramBuckets = 20;
  const maxLat = p95 * 1.5; // Cap histogram at 1.5x P95 to ignore extreme outliers in viz
  const bucketSize = maxLat / histogramBuckets;
  const histogram: Record<number, number> = {};
  
  // Initialize buckets
  for(let i=0; i<histogramBuckets; i++) histogram[i] = 0;
  
  logs.forEach(l => {
      if (l.latency > maxLat) return; // Skip outliers for chart
      const bucketIdx = Math.floor(l.latency / bucketSize);
      if (histogram[bucketIdx] !== undefined) histogram[bucketIdx]++;
  });

  const latencyHistogram = Object.entries(histogram).map(([idx, count]) => {
      const i = parseInt(idx);
      const start = (i * bucketSize).toFixed(0);
      const end = ((i + 1) * bucketSize).toFixed(0);
      return { range: `${start}-${end}ms`, count, min: i * bucketSize };
  }).sort((a,b) => a.min - b.min);

  // --- Heatmap Generation (Hour of Day) ---
  const hourMap: Record<number, { count: number; errors: number }> = {};
  for(let i=0; i<24; i++) hourMap[i] = { count: 0, errors: 0 };

  logs.forEach(l => {
      const h = new Date(l.timestamp).getHours();
      hourMap[h].count++;
      if (l.isError) hourMap[h].errors++;
  });

  const trafficHeatmap = Object.entries(hourMap).map(([h, data]) => ({
      hour: parseInt(h),
      count: data.count,
      errorRate: data.count > 0 ? (data.errors / data.count) : 0
  }));

  // --- Anomaly Detection (Statistical) ---
  const meanLat = totalLatency / totalRequests;
  const variance = latencies.reduce((sum, val) => sum + Math.pow(val - meanLat, 2), 0) / totalRequests;
  const stdDev = Math.sqrt(variance);
  
  const anomalies = logs.map(l => {
      const zScore = (l.latency - meanLat) / (stdDev || 1);
      return { ...l, anomalyScore: zScore };
  }).filter(l => {
      // Flag if latency is 3+ sigma OR if it's a 5xx error
      const isOutlier = l.anomalyScore! > 3 && l.latency > 100; // Require minimal latency to avoid flagging fast requests
      const isCritical = l.status >= 500;
      return isOutlier || isCritical;
  }).sort((a,b) => b.latency - a.latency).slice(0, 50);

  // --- Clustering ---
  const clusterMap: Record<string, LogCluster> = {};
  logs.forEach(l => {
      const template = generateLogTemplate(l.fullRequest);
      const hash = template; 
      if (!clusterMap[hash]) {
          clusterMap[hash] = {
              id: Math.random().toString(36).substr(2, 9),
              template,
              sample: l.fullRequest,
              count: 0,
              errorCount: 0,
              avgLatency: 0,
              severity: l.severity
          };
      }
      const c = clusterMap[hash];
      c.count++;
      if (l.isError) c.errorCount++;
      c.avgLatency += l.latency;
      l.clusterId = c.id; 
  });
  
  const clusters = Object.values(clusterMap)
    .map(c => ({...c, avgLatency: c.avgLatency / c.count}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); 

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
        saturation: Math.min((traffic / 100) * 100, 100) 
    },
    clusters,
    latencyHistogram,
    trafficHeatmap,
    anomalies
  };
};