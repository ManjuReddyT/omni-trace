import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ProcessedLogEntry } from '../types';
import { Search, AlertTriangle, Info, XCircle, Tag, Download, ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  logs: ProcessedLogEntry[];
}

const LogExplorer: React.FC<Props> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let regex: RegExp | null = null;
    if (search.trim() !== '') {
      try {
        regex = new RegExp(search, 'i');
      } catch {
        // Fallback to substring match if invalid regex
      }
    }

    return logs.filter((l) => {
      if (severityFilter !== 'ALL' && l.severity !== severityFilter) return false;
      if (!search) return true;
      if (regex) return regex.test(l.rawLine);
      return l.rawLine.toLowerCase().includes(search.toLowerCase());
    });
  }, [logs, search, severityFilter]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 16,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [expandedId, virtualizer]);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;

    const headers = ['Timestamp', 'Severity', 'Method', 'Path', 'Status', 'Latency(ms)', 'Message', 'UserAgent', 'RemoteIP'];

    const csvContent = [
      headers.join(','),
      ...filtered.map((l) => {
        return [
          l.timestamp,
          l.severity,
          l.method,
          l.path,
          l.status,
          l.latency,
          `"${l.fullRequest.replace(/"/g, '""')}"`,
          `"${l.userAgent.replace(/"/g, '""')}"`,
          l.remoteIp,
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `omnitrace-logs-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xl transition-colors duration-300">
      <div className="bg-slate-50 dark:bg-slate-800 p-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-full md:w-96 focus-within:border-blue-500 transition-colors">
          <Search size={14} className="text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Regex search..."
            className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-200 w-full font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex gap-1">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((level) => (
              <button
                key={level}
                onClick={() => setSeverityFilter(level)}
                className={`
                  px-3 py-1 text-xs font-bold rounded-md transition-all
                  ${severityFilter === level
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'}
                `}
              >
                {level}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 rounded-md text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export filtered logs to CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0a0f1e] p-2 font-mono text-xs md:text-sm"
      >
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
            <Search size={48} className="mb-4 opacity-20" />
            <p>No logs match your filter.</p>
          </div>
        ) : (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const log = filtered[virtualRow.index];
              const isExpanded = expandedId === log.id;

              return (
                <div
                  key={`${log.id}-${virtualRow.index}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={`group absolute top-0 left-0 w-full flex flex-col hover:bg-slate-200 dark:hover:bg-slate-800/30 p-1 rounded transition-colors border-l-2 ${
                    isExpanded
                      ? 'border-blue-400 dark:border-blue-500 bg-slate-100 dark:bg-slate-800/50'
                      : 'border-transparent hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="flex items-start gap-3 cursor-pointer" onClick={(e) => toggleExpand(log.id, e)}>
                    <span className="shrink-0 pt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="text-slate-500 shrink-0 select-none w-36">
                      {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </span>
                    <span className="shrink-0 pt-0.5" title={log.severity}>
                      {log.severity === 'INFO' && <Info size={14} className="text-blue-500/70" />}
                      {log.severity === 'WARN' && <AlertTriangle size={14} className="text-amber-500/70" />}
                      {log.severity === 'ERROR' && <XCircle size={14} className="text-red-500/70" />}
                      {log.severity === 'CRITICAL' && <AlertTriangle size={14} className="text-purple-500" />}
                    </span>
                    <div className="break-all text-slate-700 dark:text-slate-300 flex-1">
                      <span
                        className={`font-bold mr-2 ${
                          log.method === 'GET'
                            ? 'text-blue-600 dark:text-blue-400'
                            : log.method === 'POST'
                              ? 'text-green-600 dark:text-green-400'
                              : log.method === 'DELETE'
                                ? 'text-red-600 dark:text-red-400'
                                : log.method === 'SQL'
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : 'text-slate-400'
                        }`}
                      >
                        {log.method}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 mr-2">{log.path}</span>
                      {log.logType === 'HTTP' && log.status > 0 && (
                        <span
                          className={`px-1.5 rounded text-[10px] mr-2 ${
                            log.status >= 500
                              ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                              : log.status >= 400
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                          }`}
                        >
                          {log.status}
                        </span>
                      )}
                      {log.logType !== 'HTTP' && (
                        <span
                          className={`px-1.5 rounded text-[10px] mr-2 ${
                            log.isError
                              ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                              : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {log.isError ? 'ERROR' : 'SUCCESS'}
                        </span>
                      )}
                      <span className="opacity-80">
                        {log.fullRequest.length > 200 ? log.fullRequest.substring(0, 200) + '...' : log.fullRequest}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 ml-7 pl-6 py-2 border-l border-slate-300 dark:border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1">
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Request Details</div>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500">Method:</span> {log.method}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500">Path:</span> {log.path}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500">Status:</span>{' '}
                            {log.logType === 'HTTP' ? log.status : log.isError ? 'ERROR' : 'SUCCESS'}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500">Latency:</span> {log.latency} ms
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500">Bytes:</span> {log.bodyBytes} B
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Client Info</div>
                          <div className="text-xs text-slate-700 dark:text-slate-300 break-all">
                            <span className="text-slate-500">IP:</span> {log.remoteIp}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300 break-all">
                            <span className="text-slate-500">UserAgent:</span> {log.userAgent}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300 break-all">
                            <span className="text-slate-500">Referer:</span> {log.referer}
                          </div>
                        </div>
                      </div>

                      {Object.keys(log.metadata || {}).length > 0 && (
                        <div className="mb-4">
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Metadata</div>
                          <div className="flex gap-2 flex-wrap text-slate-700 dark:text-slate-300">
                            {Object.entries(log.metadata).map(([k, v]) => {
                              if (v === null || typeof v === 'object') return null;
                              return (
                                <span
                                  key={k}
                                  className="flex items-center gap-1 text-[10px] bg-slate-200 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700"
                                >
                                  <Tag size={10} className="text-slate-400" />
                                  <span className="text-slate-500">{k}:</span> {String(v)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Raw Log Line</div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded text-xs text-slate-600 dark:text-slate-400 break-all overflow-x-auto whitespace-pre-wrap font-mono">
                        {log.rawLine}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogExplorer;
