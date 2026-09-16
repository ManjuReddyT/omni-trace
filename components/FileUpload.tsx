import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Globe, Server, Code, Database, Zap, Clipboard, Loader2, FileArchive, Cloud, Terminal, Activity, Layers, Network } from 'lucide-react';
import { unzipSync, gunzipSync } from 'fflate';

interface FileUploadProps {
  onDataLoaded: (content: string, isAppend?: boolean) => void | Promise<void>;
}

const SAMPLE_LOGS: Record<string, string> = {
    'GCP Load Balancer': `{"httpRequest":{"requestMethod":"GET","requestUrl":"https://api.example.com/users/123","status":200,"responseSize":"1234","userAgent":"Mozilla/5.0","remoteIp":"203.0.113.42","latency":"0.142s"},"timestamp":"2025-01-17T14:32:01.123Z","severity":"INFO"}
{"httpRequest":{"requestMethod":"POST","requestUrl":"https://api.example.com/orders","status":500,"responseSize":"512","userAgent":"axios/1.6.0","remoteIp":"198.51.100.23","latency":"2.451s"},"timestamp":"2025-01-17T14:32:15.456Z","severity":"ERROR"}
{"httpRequest":{"requestMethod":"GET","requestUrl":"https://api.example.com/products","status":200,"responseSize":"8912","userAgent":"PostmanRuntime/7.29.0","remoteIp":"192.0.2.1","latency":"0.089s"},"timestamp":"2025-01-17T14:32:18.789Z","severity":"INFO"}
{"httpRequest":{"requestMethod":"PUT","requestUrl":"https://api.example.com/users/456","status":404,"responseSize":"256","userAgent":"curl/7.68.0","remoteIp":"203.0.113.67","latency":"0.034s"},"timestamp":"2025-01-17T14:32:22.234Z","severity":"WARNING"}
{"httpRequest":{"requestMethod":"GET","requestUrl":"https://api.example.com/health","status":200,"responseSize":"128","userAgent":"GoogleHC/1.0","remoteIp":"35.191.0.1","latency":"0.012s"},"timestamp":"2025-01-17T14:32:25.567Z","severity":"INFO"}
{"httpRequest":{"requestMethod":"POST","requestUrl":"https://api.example.com/auth/login","status":401,"responseSize":"345","userAgent":"Mozilla/5.0","remoteIp":"198.51.100.89","latency":"0.156s"},"timestamp":"2025-01-17T14:32:28.890Z","severity":"WARNING"}
{"httpRequest":{"requestMethod":"DELETE","requestUrl":"https://api.example.com/sessions/abc123","status":200,"responseSize":"64","userAgent":"Mozilla/5.0","remoteIp":"192.0.2.45","latency":"0.078s"},"timestamp":"2025-01-17T14:32:31.123Z","severity":"INFO"}
{"httpRequest":{"requestMethod":"GET","requestUrl":"https://api.example.com/api/payments","status":503,"responseSize":"256","userAgent":"axios/1.6.0","remoteIp":"203.0.113.12","latency":"5.234s"},"timestamp":"2025-01-17T14:32:34.456Z","severity":"ERROR"}`,

    'Application Logs (JSON)': `{"ts":"2025-01-17T14:32:01.123Z","level":"INFO","method":"GET","path":"/api/users","status":200,"duration":45,"msg":"handled request"}
{"ts":"2025-01-17T14:32:15.456Z","level":"ERROR","method":"POST","path":"/api/orders","status":500,"duration":2100,"msg":"payment provider timeout"}
{"ts":"2025-01-17T14:32:18.789Z","level":"WARN","method":"GET","path":"/api/inventory","status":429,"duration":12,"msg":"rate limited"}
{"ts":"2025-01-17T14:32:25.567Z","level":"INFO","method":"DELETE","path":"/sessions/abc","status":204,"duration":8,"msg":"session revoked"}`,

    'Nginx Access Logs': `203.0.113.42 - - [17/Jan/2025:14:32:01 +0000] "GET /api/users/123 HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
198.51.100.23 - - [17/Jan/2025:14:32:15 +0000] "POST /api/orders HTTP/1.1" 500 512 "-" "axios/1.6.0"
192.0.2.1 - - [17/Jan/2025:14:32:18 +0000] "GET /api/products HTTP/1.1" 200 8912 "https://example.com" "PostmanRuntime"
203.0.113.67 - - [17/Jan/2025:14:32:22 +0000] "PUT /api/users/456 HTTP/1.1" 404 256 "-" "curl/7.68.0"
35.191.0.1 - - [17/Jan/2025:14:32:25 +0000] "GET /health HTTP/1.1" 200 128 "-" "GoogleHC/1.0"
198.51.100.89 - - [17/Jan/2025:14:32:28 +0000] "POST /auth/login HTTP/1.1" 401 345 "-" "Mozilla/5.0"
192.0.2.45 - - [17/Jan/2025:14:32:31 +0000] "DELETE /sessions/abc123 HTTP/1.1" 200 64 "-" "Mozilla/5.0"
203.0.113.12 - - [17/Jan/2025:14:32:34 +0000] "GET /api/payments HTTP/1.1" 503 256 "-" "axios/1.6.0"`,

    'AWS ALB Logs': `2025-01-17T14:32:01.123Z app/load-balancer/123 203.0.113.42:1234 10.0.0.1:80 0.001 0.142 0.001 200 200 345 1234 "GET http://api.example.com:80/api/users/123 HTTP/1.1" "Mozilla/5.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2
2025-01-17T14:32:15.456Z app/load-balancer/123 198.51.100.23:4567 10.0.0.2:80 0.001 2.451 0.001 500 500 234 512 "POST http://api.example.com:80/api/orders HTTP/1.1" "axios/1.6.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2
2025-01-17T14:32:18.789Z app/load-balancer/123 192.0.2.1:3456 10.0.0.1:80 0.001 0.089 0.001 200 200 123 8912 "GET http://api.example.com:80/api/products HTTP/1.1" "PostmanRuntime" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2
2025-01-17T14:32:22.234Z app/load-balancer/123 203.0.113.67:5678 10.0.0.3:80 0.002 0.034 0.001 404 404 123 256 "PUT http://api.example.com:80/api/users/456 HTTP/1.1" "curl/7.68.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2
2025-01-17T14:32:34.456Z app/load-balancer/123 203.0.113.12:7890 10.0.0.2:80 0.001 5.234 0.001 503 503 123 256 "GET http://api.example.com:80/api/payments HTTP/1.1" "axios/1.6.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2`,

    'Kubernetes Pod Logs': `2025-01-17T14:32:01.123Z stdout F I0117 14:32:01.123456 1 controller.go:234] Successfully synced web-app
2025-01-17T14:32:15.456Z stderr F E0117 14:32:15.456789 1 reflector.go:178] Failed to watch Pod: connection refused
2025-01-17T14:32:18.789Z stdout F I0117 14:32:18.789012 1 handlers.go:156] GET /metrics 200 89ms
2025-01-17T14:32:22.234Z stdout F W0117 14:32:22.234567 1 config.go:89] Config reload triggered
2025-01-17T14:32:25.567Z stdout F I0117 14:32:25.567890 1 probe.go:45] Readiness probe succeeded
2025-01-17T14:32:28.890Z stderr F E0117 14:32:28.890123 1 auth.go:234] Authentication failed: invalid token
2025-01-17T14:32:31.123Z stdout F I0117 14:32:31.123456 1 shutdown.go:67] Received SIGTERM
2025-01-17T14:32:34.456Z stderr F E0117 14:32:34.456789 1 upstream.go:123] Upstream service not reachable`,

    'PostgreSQL Logs': `2025-01-17 14:32:01.123 UTC [1234] user@webapp LOG: duration: 142.456 ms statement: SELECT * FROM users
2025-01-17 14:32:15.456 UTC [1235] user@webapp ERROR: deadlock detected
2025-01-17 14:32:18.789 UTC [1236] user@webapp LOG: duration: 89.123 ms statement: SELECT * FROM products
2025-01-17 14:32:22.234 UTC [1237] user@webapp WARNING: no transaction in progress
2025-01-17 14:32:25.567 UTC [1238] postgres@postgres LOG: checkpoint starting
2025-01-17 14:32:28.890 UTC [1239] user@webapp ERROR: permission denied for table sensitive_data
2025-01-17 14:32:31.123 UTC [1240] user@webapp LOG: duration: 78.456 ms statement: DELETE FROM sessions
2025-01-17 14:32:34.456 UTC [1241] user@webapp ERROR: connection to server lost`,

    'MongoDB Logs': `2025-01-17T14:32:01.123+0000 I COMMAND  [conn123] command db.users command: find { filter: { name: "Alice" } } planSummary: COLLSCAN keysExamined:0 docsExamined:100 cursorExhausted:1 numYields:0 nreturned:1 reslen:234 locks:{ Global: { acquireCount: { r: 1 } }, Database: { acquireCount: { r: 1 } }, Collection: { acquireCount: { r: 1 } } } protocol:op_msg 123ms
2025-01-17T14:32:15.456+0000 W NETWORK  [conn124] Error receiving request from client: ConnectionResetByPeer
2025-01-17T14:32:18.789+0000 I COMMAND  [conn125] command db.products command: update { q: { id: 1 }, u: { $set: { stock: 0 } } } numYields:0 reslen:123 protocol:op_msg 45ms
2025-01-17T14:32:25.567+0000 E STORAGE  [conn126] WiredTiger error (24) [1705501945:567890][12345:0x7f...], file:index.wt, cursor.next: read checksum error
2025-01-17T14:32:34.456+0000 F CONTROL  [main] Fatal Assertion 12345 at src/mongo/db/storage/wiredtiger/wiredtiger_util.cpp 123`,

    'Redis Logs': `1234:M 17 Jan 2025 14:32:01.123 * Background saving started by pid 5678
5678:C 17 Jan 2025 14:32:02.123 * DB saved on disk
5678:C 17 Jan 2025 14:32:02.145 * RDB: 0 MB of memory used by copy-on-write
1234:M 17 Jan 2025 14:32:02.234 * Background saving terminated with success
1234:M 17 Jan 2025 14:32:15.456 # Possible SECURITY ATTACK detected. It looks like somebody is sending POST or Host: commands to Redis.
1234:M 17 Jan 2025 14:32:34.456 * 1 changes in 3600 seconds. Saving...`,

    'Spring Boot / Java': `2025-01-17 14:32:01.123  INFO 12345 --- [nio-8080-exec-1] c.e.controller.UserController : Processing GET /api/users request
2025-01-17 14:32:01.234  INFO 12345 --- [nio-8080-exec-1] c.e.service.UserService       : Fetching user details for ID: 123
2025-01-17 14:32:15.456  WARN 12345 --- [nio-8080-exec-2] c.e.config.SecurityConfig     : Invalid API Key provided
2025-01-17 14:32:25.567 ERROR 12345 --- [nio-8080-exec-3] c.e.handler.GlobalExceptionHandler: Exception occurred while processing request
java.lang.NullPointerException: null
	at com.example.service.OrderService.process(OrderService.java:45)
	at com.example.controller.OrderController.create(OrderController.java:32)
2025-01-17 14:32:34.456  INFO 12345 --- [main] c.e.Application                 : Application started in 2.345 seconds`,

    'Envoy Access Logs': `[2025-01-17T14:32:01.123Z] "GET /api/v1/users HTTP/1.1" 200 - 0 1234 10 10 "-" "Mozilla/5.0" "10.0.0.1" "api.example.com"
[2025-01-17T14:32:15.456Z] "POST /api/v1/orders HTTP/1.1" 503 UH 512 0 5000 5000 "-" "axios/0.21.1" "10.0.0.2" "api.example.com"
[2025-01-17T14:32:18.789Z] "GET /health HTTP/1.1" 200 - 0 15 2 1 "-" "KubeProbe/1.22" "10.0.0.3" "api.example.com"
[2025-01-17T14:32:22.234Z] "PUT /api/v1/products/123 HTTP/1.1" 404 - 200 50 15 15 "-" "curl/7.64.1" "10.0.0.4" "api.example.com"`,

    'CloudFront Logs': `#Fields: date time x-edge-location sc-bytes c-ip cs-method cs(Host) cs-uri-stem sc-status cs(Referer) cs(User-Agent) cs-uri-query cs(Cookie) x-edge-result-type x-edge-request-id x-host-header cs-protocol cs-bytes time-taken x-forwarded-for ssl-protocol ssl-cipher x-edge-response-result-type cs-protocol-version fle-status fle-encrypted-fields c-port time-to-first-byte x-edge-detailed-result-type sc-content-type sc-content-len sc-range-start sc-range-end
2025-01-17	14:32:01	SFO53-P1	1234	203.0.113.42	GET	d123.cloudfront.net	/api/users	200	-	Mozilla/5.0	-	-	Hit	AbC123==	example.com	https	345	0.142	-	TLSv1.2	ECDHE-RSA-AES128-GCM-SHA256	Hit	HTTP/2.0	-	-	12345	0.140	Hit	application/json	1234	-	-
2025-01-17	14:32:15	JFK50-C1	512	198.51.100.23	POST	d123.cloudfront.net	/api/orders	500	-	axios/1.6.0	-	-	Error	XyZ987==	example.com	https	234	2.451	-	TLSv1.3	TLS_AES_128_GCM_SHA256	Error	HTTP/2.0	-	-	45678	2.450	Error	application/json	512	-	-
2025-01-17	14:32:34	LHR4-C2	256	203.0.113.12	GET	d123.cloudfront.net	/api/payments	503	-	axios/1.6.0	-	-	Error	MnOp56==	example.com	https	123	5.234	-	TLSv1.2	ECDHE-RSA-AES128-GCM-SHA256	Error	HTTP/2.0	-	-	78901	5.230	Error	application/json	256	-	-`
  };

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'stream'>('upload');
  const [textInput, setTextInput] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to hold polling interval
  const pollingRef = useRef<number | null>(null);

  const stopStreaming = () => {
      setIsStreaming(false);
      if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
      }
  };

  const startUrlStream = async () => {
      if (!streamUrl.trim()) return;
      setIsStreaming(true);
      try {
          const response = await fetch(streamUrl);
          if (!response.body) throw new Error("No response body");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let isFirstChunk = true;
          
          while (true) {
              const { done, value } = await reader.read();
              if (done) {
                  if (buffer.trim()) onDataLoaded(buffer, !isFirstChunk);
                  stopStreaming();
                  break;
              }
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              const lastNewlineIndex = buffer.lastIndexOf('\n');
              if (lastNewlineIndex !== -1) {
                  const completeLines = buffer.substring(0, lastNewlineIndex);
                  buffer = buffer.substring(lastNewlineIndex + 1);
                  if (completeLines.trim()) {
                      onDataLoaded(completeLines, !isFirstChunk);
                      isFirstChunk = false;
                  }
              }
          }
      } catch (err) {
          console.error("Streaming error", err);
          alert("Failed to stream from URL. Ensure CORS is enabled and URL is reachable.");
          stopStreaming();
      }
  };

  const startLocalFileTail = async () => {
      try {
          // @ts-ignore - File System Access API
          const [fileHandle] = await window.showOpenFilePicker({
              types: [
                  {
                      description: 'Log Files',
                      accept: {
                          'text/plain': ['.log', '.txt', '.json', '.csv']
                      }
                  }
              ]
          });
          
          setIsStreaming(true);
          let file = await fileHandle.getFile();
          
          let lastSize = file.size;
          let buffer = '';
          let isFirstChunk = true;
          
          // Initial read: load the last 5MB if file is huge
          const MAX_INITIAL_LOAD = 5 * 1024 * 1024;
          const startSlice = Math.max(0, lastSize - MAX_INITIAL_LOAD);
          const initialBlob = file.slice(startSlice, lastSize);
          let initialContent = await initialBlob.text();
          
          buffer = initialContent;
          const lastNewlineIndex = buffer.lastIndexOf('\n');
          if (lastNewlineIndex !== -1) {
              const completeLines = buffer.substring(0, lastNewlineIndex);
              buffer = buffer.substring(lastNewlineIndex + 1);
              
              // Skip the first line if we started mid-file (meaning startSlice > 0)
              const firstNewlineIndex = completeLines.indexOf('\n');
              const finalLines = (startSlice > 0 && firstNewlineIndex !== -1) 
                  ? completeLines.substring(firstNewlineIndex + 1) 
                  : completeLines;
                  
              if (finalLines.trim()) {
                  onDataLoaded(finalLines, !isFirstChunk);
                  isFirstChunk = false;
              }
          }

          // Poll for changes
          pollingRef.current = window.setInterval(async () => {
              try {
                  const currentFile = await fileHandle.getFile();
                  if (currentFile.size > lastSize) {
                      const newSlice = currentFile.slice(lastSize);
                      const text = await newSlice.text();
                      buffer += text;
                      const lastNewline = buffer.lastIndexOf('\n');
                      if (lastNewline !== -1) {
                          const completeLines = buffer.substring(0, lastNewline);
                          buffer = buffer.substring(lastNewline + 1);
                          if (completeLines.trim()) {
                              onDataLoaded(completeLines, !isFirstChunk);
                              isFirstChunk = false;
                          }
                      }
                      lastSize = currentFile.size;
                  } else if (currentFile.size < lastSize) {
                      // File got truncated/rotated
                      lastSize = 0;
                      buffer = '';
                  }
              } catch (e) {
                  console.error("Error tailing file", e);
                  stopStreaming();
              }
          }, 1000);

      } catch (err) {
          console.error("File selection error", err);
          stopStreaming();
      }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    try {
        if (file.name.endsWith('.gz')) {
            const buffer = await file.arrayBuffer();
            const decompressed = gunzipSync(new Uint8Array(buffer));
            const content = new TextDecoder().decode(decompressed);
            onDataLoaded(content);
        } else if (file.name.endsWith('.zip')) {
            const buffer = await file.arrayBuffer();
            const unzipped = unzipSync(new Uint8Array(buffer));
            let content = '';
            for (const path in unzipped) {
                 if (!path.endsWith('/') && !path.includes('__MACOSX')) {
                     content += new TextDecoder().decode(unzipped[path]) + '\n';
                 }
            }
            onDataLoaded(content);
        } else {
            // Read large text files in chunks to avoid blocking the main thread
            const stream = file.stream();
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let isFirstChunk = true;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim()) onDataLoaded(buffer, !isFirstChunk);
                    break;
                }
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lastNewlineIndex = buffer.lastIndexOf('\n');
                if (lastNewlineIndex !== -1) {
                    const completeLines = buffer.substring(0, lastNewlineIndex);
                    buffer = buffer.substring(lastNewlineIndex + 1);
                    if (completeLines.trim()) {
                        onDataLoaded(completeLines, !isFirstChunk);
                        isFirstChunk = false;
                    }
                }
                // Yield to UI thread to keep the "Processing Logs..." spinner spinning
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    } catch (e) {
        console.error("File processing error", e);
        alert('Failed to process file. Ensure it is a valid text, zip, or gz file.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handlePasteSubmit = () => {
      if (textInput.trim()) {
          onDataLoaded(textInput);
      }
  };

  const loadSample = (type: string) => {
    const sample = SAMPLE_LOGS[type];
    if (!sample) {
      console.error(`No sample logs defined for "${type}"`);
      return;
    }
    onDataLoaded(sample);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-slate-900 dark:to-black text-slate-900 dark:text-white flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-4xl w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-cyan-400 dark:via-blue-500 dark:to-purple-600 pb-2">
                OmniTrace
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl font-light max-w-2xl mx-auto">
                The modern, privacy-first command center for SREs. Visualize latency, track errors, and cluster patterns instantly in your browser.
            </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center">
            <div className="bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300 dark:border-slate-700/50 flex gap-1">
                <button 
                    onClick={() => setActiveTab('upload')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'upload' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'
                    }`}
                >
                    <UploadCloud size={16} /> File Upload
                </button>
                <button 
                    onClick={() => setActiveTab('paste')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'paste' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'
                    }`}
                >
                    <Clipboard size={16} /> Paste Text
                </button>
                <button 
                    onClick={() => setActiveTab('stream')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'stream' 
                        ? 'bg-emerald-600 text-white shadow-lg' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'
                    }`}
                >
                    <Activity size={16} /> Stream
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {isProcessing && (
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                    <p className="text-lg font-medium text-slate-800 dark:text-blue-200">Processing Logs...</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Decompressing and parsing data</p>
                </div>
            )}

            {/* Upload Tab */}
            {activeTab === 'upload' && (
                <div 
                    className={`
                        relative group rounded-2xl border-2 border-dashed transition-all duration-300 ease-out py-12 px-8 text-center cursor-pointer
                        ${isDragging 
                            ? 'border-blue-400 bg-blue-50 dark:bg-cyan-900/10 scale-[1.01] shadow-2xl' 
                            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept=".log,.txt,.json,.csv,.tsv,.gz,.zip"
                    />
                    
                    <div className="flex flex-col items-center gap-6 pointer-events-none">
                        <div className={`
                            p-6 rounded-full bg-slate-100 dark:bg-slate-800 shadow-xl transition-transform duration-300 group-hover:scale-110 group-hover:bg-slate-200 dark:group-hover:bg-slate-700
                        `}>
                            <UploadCloud size={48} className="text-blue-500 dark:text-cyan-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-semibold text-slate-800 dark:text-white">Drop your logs here</h3>
                            <p className="text-slate-500 dark:text-slate-400">Supports .log, .json, .csv, .zip, .gz</p>
                        </div>
                        <div className="flex gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                            <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">Text</span>
                            <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">GZIP</span>
                            <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">ZIP</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Paste Tab */}
            {activeTab === 'paste' && (
                <div className="space-y-4 h-[350px] flex flex-col">
                    <textarea 
                        className="w-full flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        placeholder="Paste your raw logs here..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                    />
                    <div className="flex justify-end">
                        <button 
                            disabled={!textInput.trim()}
                            onClick={handlePasteSubmit}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
                        >
                            Analyze Text
                        </button>
                    </div>
                </div>
            )}

            {/* Stream Tab */}
            {activeTab === 'stream' && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <Globe className="text-emerald-500" size={20} /> Stream from URL
                             </h3>
                             <p className="text-sm text-slate-600 dark:text-slate-400">
                                 Stream logs from any HTTP endpoint. Supports chunked transfer encoding and SSE.
                             </p>
                        </div>
                        <div className="flex gap-4">
                            <input 
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50"
                                placeholder="http://localhost:8080/stream"
                                value={streamUrl}
                                onChange={(e) => setStreamUrl(e.target.value)}
                                disabled={isStreaming}
                            />
                            {isStreaming ? (
                                <button 
                                    onClick={stopStreaming}
                                    className="bg-red-500 hover:bg-red-400 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-500/20 whitespace-nowrap flex items-center gap-2"
                                >
                                    <Loader2 size={16} className="animate-spin" /> Stop
                                </button>
                            ) : (
                                <button 
                                    disabled={!streamUrl.trim()}
                                    onClick={startUrlStream}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                                >
                                    Start Stream
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-widest divider">
                        <span className="h-px bg-slate-300 dark:bg-slate-800 flex-1"></span>
                        <span>OR</span>
                        <span className="h-px bg-slate-300 dark:bg-slate-800 flex-1"></span>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <Terminal className="text-blue-500" size={20} /> Tail Local File
                             </h3>
                             <p className="text-sm text-slate-600 dark:text-slate-400">
                                 Select a local log file, and we will continuously poll it for new lines. Useful for command output piped to a file `command &gt; output.log`.
                             </p>
                        </div>
                        <button 
                            onClick={startLocalFileTail}
                            disabled={isStreaming}
                            className="w-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 px-6 py-4 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            <FileText size={20} /> Select File to Tail
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Sample Data Section */}
        <div className="space-y-6">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-widest divider">
                <span className="h-px bg-slate-300 dark:bg-slate-800 flex-1"></span>
                <span>Or try with Sample Data</span>
                <span className="h-px bg-slate-300 dark:bg-slate-800 flex-1"></span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { name: 'GCP Load Balancer', icon: Globe, color: 'text-blue-500 dark:text-blue-400', desc: 'JSON Structure' },
                    { name: 'Nginx Access Logs', icon: Server, color: 'text-green-500 dark:text-green-400', desc: 'CLF / Combined' },
                    { name: 'Application Logs (JSON)', icon: Code, color: 'text-purple-500 dark:text-purple-400', desc: 'Structured App' },
                    { name: 'AWS ALB Logs', icon: Cloud, color: 'text-orange-500 dark:text-orange-400', desc: 'ELB / ALB Format' },
                    { name: 'Envoy Access Logs', icon: Network, color: 'text-pink-500 dark:text-pink-400', desc: 'Standard Envoy' },
                    { name: 'CloudFront Logs', icon: Globe, color: 'text-indigo-500 dark:text-indigo-400', desc: 'TSV W3C' },
                    { name: 'Kubernetes Pod Logs', icon: Database, color: 'text-cyan-500 dark:text-cyan-400', desc: 'StdOut / StdErr' },
                    { name: 'PostgreSQL Logs', icon: Zap, color: 'text-yellow-500 dark:text-yellow-400', desc: 'DB Queries' },
                    { name: 'MongoDB Logs', icon: Database, color: 'text-emerald-500 dark:text-emerald-400', desc: 'Mongo Text' },
                    { name: 'Redis Logs', icon: Layers, color: 'text-red-500 dark:text-red-400', desc: 'Redis Stdout' },
                    { name: 'Spring Boot / Java', icon: Terminal, color: 'text-teal-500 dark:text-teal-400', desc: 'Logback Stdout' },
                ].map((sample) => (
                    <button
                        key={sample.name}
                        data-testid={`sample-${sample.name}`}
                        onClick={() => loadSample(sample.name)}
                        className="group bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl"
                    >
                        <sample.icon className={`mb-3 ${sample.color}`} size={24} />
                        <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white mb-1 truncate">
                            {sample.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                            {sample.desc}
                        </div>
                    </button>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default FileUpload;