import React, { useMemo, useState } from 'react';
import { ProcessedLogEntry, AppSettings } from '../types';
import { aggregateStats } from '../utils';
import GoldenSignals from './GoldenSignals';
import LogExplorer from './LogExplorer';
import AIInsights from './AIInsights';
import { TrafficChart, StatusDistribution, TopEndpointsChart, LatencyHistogram, HeatmapGrid } from './Charts';
import { LayoutDashboard, FileText, Layers, Sparkles, Filter, ArrowLeft, Search, X, Activity, BarChart2, AlertTriangle, Zap } from 'lucide-react';

interface DashboardProps {
  logs: ProcessedLogEntry[];
  onReset: () => void;
  settings: AppSettings;
}

type Tab = 'OVERVIEW' | 'EXPLORER' | 'PATTERNS' | 'ANOMALIES' | 'AI';
type TimeRange = 'ALL' | '15M' | '1H' | '6H' | '24H';

const Dashboard: React.FC<DashboardProps> = ({ logs, onReset, settings }) => {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [filterText, setFilterText] = useState('');
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [selectedStatusClasses, setSelectedStatusClasses] = useState<string[]>([]);
  const [minLatency, setMinLatency] = useState<string>('');
  const [maxLatency, setMaxLatency] = useState<string>('');
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Derive unique methods from logs for the filter options
  const availableMethods = useMemo(() => {
    const methods = new Set(logs.map(l => l.method));
    return Array.from(methods).sort();
  }, [logs]);

  // Determine the latest timestamp in the logs to act as "now" for relative time filtering
  const latestTimestamp = useMemo(() => {
    if (logs.length === 0) return 0;
    return logs.reduce((max, log) => {
        const t = new Date(log.timestamp).getTime();
        return t > max ? t : max;
    }, 0);
  }, [logs]);

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    const minLat = minLatency === '' ? 0 : parseFloat(minLatency);
    const maxLat = maxLatency === '' ? Infinity : parseFloat(maxLatency);
    
    // Time range calculation
    let timeCutoff = 0;
    if (timeRange !== 'ALL' && latestTimestamp > 0) {
        const msMap: Record<string, number> = {
            '15M': 15 * 60 * 1000,
            '1H': 60 * 60 * 1000,
            '6H': 6 * 60 * 60 * 1000,
            '24H': 24 * 60 * 60 * 1000,
        };
        timeCutoff = latestTimestamp - (msMap[timeRange] || 0);
    }

    return logs.filter(log => {
      // 1. Text Search
      const matchesText = 
        filterText === '' ||
        log.path.toLowerCase().includes(filterText.toLowerCase()) || 
        log.method.toLowerCase().includes(filterText.toLowerCase());
      
      if (!matchesText) return false;

      // 2. Method Filter
      if (selectedMethods.length > 0 && !selectedMethods.includes(log.method)) {
          return false;
      }

      // 3. Status Class Filter
      if (selectedStatusClasses.length > 0) {
          const statusClass = Math.floor(log.status / 100) + 'xx';
          if (!selectedStatusClasses.includes(statusClass)) return false;
      }

      // 4. Latency Filter
      if (log.latency < minLat) return false;
      if (log.latency > maxLat) return false;

      // 5. Time Range
      if (timeCutoff > 0) {
          const logTime = new Date(log.timestamp).getTime();
          if (logTime < timeCutoff) return false;
      }

      return true;
    });
  }, [logs, filterText, selectedMethods, selectedStatusClasses, minLatency, maxLatency, timeRange, latestTimestamp]);

  const stats = useMemo(() => aggregateStats(filteredLogs), [filteredLogs]);

  const toggleMethod = (m: string) => {
      setSelectedMethods(prev => 
        prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      );
  };

  const toggleStatusClass = (c: string) => {
    setSelectedStatusClasses(prev => 
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const clearFilters = () => {
      setFilterText('');
      setSelectedMethods([]);
      setSelectedStatusClasses([]);
      setMinLatency('');
      setMaxLatency('');
      setTimeRange('ALL');
  };

  const activeFilterCount = 
    (filterText ? 1 : 0) + 
    selectedMethods.length + 
    selectedStatusClasses.length + 
    (minLatency ? 1 : 0) + 
    (maxLatency ? 1 : 0) + 
    (timeRange !== 'ALL' ? 1 : 0);

  return (
    <div className="min-h-screen pb-20 font-sans transition-colors duration-300">
      {/* Navbar */}
      <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onReset}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
                        title="Go back to file upload screen"
                        aria-label="Go back to file upload screen"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">
                        LogPulse
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            SRE Command Center
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 pr-20">
                    {/* Tab Navigation */}
                    <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 mr-4">
                        {[
                            { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Overview' },
                            { id: 'EXPLORER', icon: FileText, label: 'Logs' },
                            { id: 'PATTERNS', icon: Layers, label: 'Patterns' },
                            { id: 'ANOMALIES', icon: AlertTriangle, label: 'Anomalies' },
                            { id: 'AI', icon: Sparkles, label: 'AI Insight' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                aria-label={`Switch to ${tab.label} dashboard view`}
                                className={`
                                    flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all
                                    ${activeTab === tab.id 
                                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50'}
                                `}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        aria-label={showFilters ? "Hide log filters panel" : "Show log filters panel"}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium
                            ${showFilters || activeFilterCount > 0
                                ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}
                        `}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="bg-blue-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Expandable Filter Bar */}
            {(showFilters || activeFilterCount > 0) && (
                <div className="py-4 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-wrap items-center gap-6">
                        {/* Time Range */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time Range</label>
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                {['ALL', '24H', '6H', '1H', '15M'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range as TimeRange)}
                                        aria-label={`Filter logs by time range: ${range}`}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${
                                            timeRange === range 
                                            ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm font-medium' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                         {/* Search Filter */}
                         <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search</label>
                            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                                <Search size={14} className="text-slate-400 dark:text-slate-500 mr-2" />
                                <input 
                                    type="text"
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    placeholder="Method or Path..."
                                    aria-label="Search logs by HTTP method or endpoint path"
                                    className="bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-200 w-32 md:w-48 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                         </div>

                         {/* Status Filter */}
                         <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Class</label>
                            <div className="flex items-center gap-2">
                                {['2xx', '3xx', '4xx', '5xx'].map((cls) => {
                                    const isActive = selectedStatusClasses.includes(cls);
                                    let color = 'slate';
                                    if (cls === '2xx') color = 'emerald';
                                    if (cls === '3xx') color = 'blue';
                                    if (cls === '4xx') color = 'amber';
                                    if (cls === '5xx') color = 'red';

                                    return (
                                        <button
                                            key={cls}
                                            onClick={() => toggleStatusClass(cls)}
                                            aria-label={`Toggle HTTP ${cls} status class filter`}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-xs font-mono border transition-all
                                                ${isActive 
                                                    ? `bg-${color}-100 dark:bg-${color}-500/20 border-${color}-400 dark:border-${color}-500 text-${color}-700 dark:text-${color}-400` 
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'}
                                            `}
                                        >
                                            {cls}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Latency Filter */}
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Latency (ms)</label>
                             <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={minLatency}
                                    onChange={(e) => setMinLatency(e.target.value)}
                                    placeholder="Min"
                                    aria-label="Minimum latency filter in milliseconds"
                                    title="Filters logs with latency greater than or equal to this value in milliseconds"
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm w-20 focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
                                />
                                <span className="text-slate-400 dark:text-slate-600">-</span>
                                <input 
                                    type="number" 
                                    value={maxLatency}
                                    onChange={(e) => setMaxLatency(e.target.value)}
                                    placeholder="Max"
                                    aria-label="Maximum latency filter in milliseconds"
                                    title="Filters logs with latency less than or equal to this value in milliseconds"
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm w-20 focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
                                />
                             </div>
                        </div>
                        
                        {/* Clear Button */}
                        {activeFilterCount > 0 && (
                            <div className="pt-5">
                                <button 
                                    onClick={clearFilters}
                                    aria-label="Clear all active log filters"
                                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1"
                                >
                                    <X size={12} /> Clear All
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        
        {/* GOLDEN SIGNALS - Always Visible at Top */}
        <GoldenSignals data={stats.goldenSignals} />

        {/* Tab Content */}
        {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                {/* Row 1: Traffic, Status, Histogram */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 backdrop-blur-sm shadow-sm dark:shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                Traffic & Errors
                            </h3>
                        </div>
                        <TrafficChart data={stats} theme={settings.theme} />
                    </div>

                    <div className="space-y-6">
                         <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 backdrop-blur-sm shadow-sm dark:shadow-xl h-[50%]">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Status</h3>
                            </div>
                            <StatusDistribution data={stats} theme={settings.theme} />
                             <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>2xx</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span>3xx</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span>4xx</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span>5xx</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 backdrop-blur-sm shadow-sm dark:shadow-xl h-[46%]">
                             <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                     <BarChart2 size={16} className="text-blue-500 dark:text-blue-400" /> Latency
                                </h3>
                            </div>
                            <LatencyHistogram data={stats} theme={settings.theme} />
                        </div>
                    </div>
                </div>

                {/* Row 2: Heatmap & Slowest Endpoints */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 backdrop-blur-sm shadow-sm dark:shadow-xl flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                                Hourly Intensity
                            </h3>
                        </div>
                        <HeatmapGrid data={stats} theme={settings.theme} />
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 backdrop-blur-sm shadow-sm dark:shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Slowest Endpoints</h3>
                        </div>
                        <TopEndpointsChart data={stats} theme={settings.theme} />
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'EXPLORER' && (
             <div className="animate-in slide-in-from-bottom-2 duration-300">
                <LogExplorer logs={filteredLogs} />
             </div>
        )}

        {activeTab === 'PATTERNS' && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Layers className="text-purple-500 dark:text-purple-400" size={20} />
                        Log Pattern Clustering
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                        We've automatically grouped {filteredLogs.length} logs into {stats.clusters.length} unique patterns by removing dynamic variables (IDs, Timestamps, IPs).
                    </p>
                    <div className="space-y-3">
                        {stats.clusters.map(cluster => (
                            <div key={cluster.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-slate-400 dark:hover:border-slate-500 transition-colors group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all pr-4">
                                        {cluster.template}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                         <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                            {cluster.count} occurrences
                                        </span>
                                        <div className="flex gap-2 text-[10px]">
                                             <span className={`${cluster.errorCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-600'}`}>
                                                 {cluster.errorCount} Errors
                                             </span>
                                             <span className="text-slate-400">|</span>
                                             <span className="text-amber-600 dark:text-amber-400">
                                                 ~{cluster.avgLatency.toFixed(0)}ms avg
                                             </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-600 font-mono mt-2 bg-white dark:bg-slate-950/50 p-2 rounded truncate group-hover:whitespace-normal group-hover:h-auto group-hover:overflow-visible transition-all border border-slate-100 dark:border-slate-800">
                                    Sample: {cluster.sample}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'ANOMALIES' && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                     <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />
                        Statistical Anomalies
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                        We detected {stats.anomalies.length} logs that deviate significantly from normal latency patterns (Z-Score &gt; 3) or represent critical failures.
                    </p>
                    <div className="space-y-2">
                        {stats.anomalies.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 border-dashed">
                                No significant anomalies detected in the current dataset.
                            </div>
                        ) : (
                            stats.anomalies.map(log => (
                                <div key={log.id} className="bg-slate-50 dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-lg p-3 flex gap-4 items-start hover:border-red-400 dark:hover:border-red-500/50 transition-colors">
                                    <div className="shrink-0 pt-1">
                                        <div className="bg-red-500/10 p-2 rounded text-red-600 dark:text-red-400 font-bold text-xs flex flex-col items-center">
                                            <span>{log.latency.toFixed(0)}ms</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-500 font-mono">{log.timestamp}</span>
                                            {log.anomalyScore && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-500/10 px-2 rounded-full border border-amber-200 dark:border-amber-500/20">
                                                    +{log.anomalyScore.toFixed(1)}σ Deviation
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-mono text-sm text-slate-800 dark:text-slate-200 truncate mt-1">
                                            {log.method} {log.path}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 truncate">
                                            {log.fullRequest}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'AI' && (
             <div className="animate-in slide-in-from-bottom-2 duration-300">
                 <AIInsights 
                    stats={stats} 
                    settings={settings}
                    filters={{
                        filterText,
                        selectedMethods,
                        selectedStatusClasses,
                        minLatency,
                        maxLatency,
                        timeRange
                    }}
                 />
             </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;