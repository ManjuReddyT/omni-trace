import React, { useState, useMemo } from 'react';
import { ProcessedLogEntry } from '../types';
import { Search, AlertTriangle, CheckCircle, Info, XCircle, Tag } from 'lucide-react';

interface Props {
  logs: ProcessedLogEntry[];
}

const LogExplorer: React.FC<Props> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (severityFilter !== 'ALL' && l.severity !== severityFilter) return false;
      if (!search) return true;
      return l.rawLine.toLowerCase().includes(search.toLowerCase());
    });
  }, [logs, search, severityFilter]);

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xl transition-colors duration-300">
      {/* Toolbar */}
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

        <div className="flex gap-1">
          {['ALL', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map(level => (
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
      </div>

      {/* Log Window */}
      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0a0f1e] p-2 font-mono text-xs md:text-sm">
        {filtered.slice(0, 500).map((log, i) => (
          <div key={log.id} className="group flex items-start gap-3 hover:bg-slate-200 dark:hover:bg-slate-800/30 p-1 rounded transition-colors border-l-2 border-transparent hover:border-slate-400 dark:hover:border-slate-600">
            {/* Timestamp */}
            <span className="text-slate-500 shrink-0 select-none w-36">{log.timestamp.replace('T', ' ').slice(0, 19)}</span>
            
            {/* Severity Icon */}
            <span className="shrink-0 pt-0.5">
               {log.severity === 'INFO' && <Info size={14} className="text-blue-500/70" />}
               {log.severity === 'WARN' && <AlertTriangle size={14} className="text-amber-500/70" />}
               {log.severity === 'ERROR' && <XCircle size={14} className="text-red-500/70" />}
               {log.severity === 'CRITICAL' && <AlertTriangle size={14} className="text-purple-500" />}
            </span>

            {/* Content */}
            <div className="break-all text-slate-700 dark:text-slate-300 flex-1">
               {/* Highlight method if present */}
               <span className={`font-bold mr-2 ${
                   log.method === 'GET' ? 'text-blue-600 dark:text-blue-400' : 
                   log.method === 'POST' ? 'text-green-600 dark:text-green-400' : 
                   log.method === 'DELETE' ? 'text-red-600 dark:text-red-400' : 
                   log.method === 'SQL' ? 'text-purple-600 dark:text-purple-400' :
                   log.method === 'LOG' ? 'text-slate-400' : 'text-slate-400'
               }`}>
                   {log.method}
               </span>
               <span className="text-slate-600 dark:text-slate-400 mr-2">{log.path}</span>
               
               {/* Status */}
               {log.status > 0 && (
                   <span className={`px-1.5 rounded text-[10px] mr-2 ${
                       log.status >= 500 ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' :
                       log.status >= 400 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                       'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                   }`}>
                       {log.status}
                   </span>
               )}

               <span className="opacity-80">{log.fullRequest.length > 200 ? log.fullRequest.substring(0, 200) + '...' : log.fullRequest}</span>
            
               {/* Metadata Tags */}
               {Object.keys(log.metadata || {}).length > 0 && (
                 <div className="flex gap-2 mt-1 flex-wrap opacity-80">
                   {Object.entries(log.metadata).map(([k, v]) => {
                     // Filter out objects/nulls to keep UI clean
                     if (v === null || typeof v === 'object') return null;

                     const isDuration = k.toLowerCase() === 'duration';
                     const label = isDuration ? 'Duration' : k;

                     return (
                       <span key={k} className={`flex items-center gap-1 text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 rounded border border-slate-300 dark:border-slate-700 ${isDuration ? 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' : 'text-slate-500 dark:text-slate-400'}`}>
                         <Tag size={10} />
                         {label}: {String(v)}
                       </span>
                     );
                   })}
                 </div>
               )}
            </div>
          </div>
        ))}
        
        {filtered.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
            <Search size={48} className="mb-4 opacity-20" />
            <p>No logs match your filter.</p>
          </div>
        )}
        
        {filtered.length > 500 && (
          <div className="py-4 text-center text-slate-500 italic border-t border-slate-200 dark:border-slate-800/50 mt-4">
            Showing first 500 of {filtered.length} matches...
          </div>
        )}
      </div>
    </div>
  );
};

export default LogExplorer;