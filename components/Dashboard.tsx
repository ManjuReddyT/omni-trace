import React, { useMemo, useState, useEffect } from 'react';
import { ProcessedLogEntry, AppSettings } from '../types';
import { aggregateStats } from '../utils';
import GoldenSignals from './GoldenSignals';
import LogExplorer from './LogExplorer';
import AIInsights from './AIInsights';
import { TrafficChart, StatusDistribution, TopEndpointsChart, LatencyHistogram, HeatmapGrid } from './Charts';
import { LayoutDashboard, FileText, Layers, Sparkles, Filter, ArrowLeft, Search, X, Activity, BarChart2, AlertTriangle, Zap, Plus, Trash2, Maximize2, Minimize2, MoveRight, Settings, Share2, Check } from 'lucide-react';
import { useUrlState } from '../hooks/useUrlState';

interface DashboardProps {
  logs: ProcessedLogEntry[];
  onReset: () => void;
  settings: AppSettings;
}

type Tab = 'OVERVIEW' | 'EXPLORER' | 'PATTERNS' | 'ANOMALIES' | 'AI';
type TimeRange = 'ALL' | '15M' | '1H' | '6H' | '24H';

export type WidgetType = 'TRAFFIC' | 'STATUS' | 'LATENCY' | 'HEATMAP' | 'ENDPOINTS';
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  width: 1 | 2 | 3;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: '1', type: 'TRAFFIC', width: 2 },
  { id: '2', type: 'STATUS', width: 1 },
  { id: '3', type: 'HEATMAP', width: 3 },
  { id: '4', type: 'LATENCY', width: 1 },
  { id: '5', type: 'ENDPOINTS', width: 2 },
];

const WIDGET_OPTIONS = [
  { type: 'TRAFFIC', label: 'Traffic & Errors', icon: Activity },
  { type: 'STATUS', label: 'Status Distribution', icon: Activity },
  { type: 'LATENCY', label: 'Latency Histogram', icon: BarChart2 },
  { type: 'HEATMAP', label: 'Hourly Intensity Heatmap', icon: Zap },
  { type: 'ENDPOINTS', label: 'Slowest Endpoints', icon: Activity },
];

const DASHBOARD_TABS: { id: Tab; icon: typeof LayoutDashboard; label: string }[] = [
  { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Overview' },
  { id: 'EXPLORER', icon: FileText, label: 'Logs' },
  { id: 'PATTERNS', icon: Layers, label: 'Patterns' },
  { id: 'ANOMALIES', icon: AlertTriangle, label: 'Anomalies' },
  { id: 'AI', icon: Sparkles, label: 'AI Insight' },
];

const INACTIVE_CHIP = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500';

const LOG_TYPE_ACTIVE: Record<string, string> = {
  HTTP: 'bg-blue-100 dark:bg-blue-500/20 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-400',
  DATABASE: 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400',
  SYSTEM: 'bg-purple-100 dark:bg-purple-500/20 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-400',
  APP: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400',
  UNKNOWN: 'bg-slate-200 dark:bg-slate-500/20 border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-300',
};

const STATUS_ACTIVE: Record<string, string> = {
  '2xx': 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400',
  Success: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400',
  '3xx': 'bg-blue-100 dark:bg-blue-500/20 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-400',
  '4xx': 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-400',
  '5xx': 'bg-red-100 dark:bg-red-500/20 border-red-400 dark:border-red-500 text-red-700 dark:text-red-400',
  Error: 'bg-red-100 dark:bg-red-500/20 border-red-400 dark:border-red-500 text-red-700 dark:text-red-400',
};

const Dashboard: React.FC<DashboardProps> = ({ logs, onReset, settings }) => {
  const [activeTab, setActiveTab] = useUrlState<Tab>('tab', 'OVERVIEW');
  const [filterText, setFilterText] = useUrlState('search', '');
  const [selectedMethods, setSelectedMethods] = useUrlState<string[]>('methods', []);
  const [selectedStatusClasses, setSelectedStatusClasses] = useUrlState<string[]>('status', []);
  const [selectedLogTypes, setSelectedLogTypes] = useUrlState<string[]>('logTypes', []);
  const [minLatency, setMinLatency] = useUrlState<string>('minLat', '');
  const [maxLatency, setMaxLatency] = useUrlState<string>('maxLat', '');
  const [timeRange, setTimeRange] = useUrlState<TimeRange>('time', 'ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('omnitrace_widgets');
    return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
  });

  useEffect(() => {
    localStorage.setItem('omnitrace_widgets', JSON.stringify(widgets));
  }, [widgets]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const addWidget = (type: WidgetType) => {
    setWidgets(prev => [...prev, { id: Date.now().toString(), type, width: 1 }]);
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const resizeWidget = (id: string, width: 1 | 2 | 3) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, width } : w));
  };

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
      const matchesText = (() => {
        if (filterText === '') return true;
        const ft = filterText.toLowerCase();
        
        let logKey = `${log.method} ${log.path}`.toLowerCase();
        if (log.logType === 'DATABASE') logKey = `[db] ${logKey}`;
        else if (log.logType === 'SYSTEM') logKey = `[sys] ${log.path.toLowerCase()}`;
        else if (log.logType === 'APP') logKey = `[app] ${logKey}`;
        
        return logKey.includes(ft) || log.fullRequest.toLowerCase().includes(ft);
      })();
      
      if (!matchesText) return false;

      // 2. Log Type Filter
      if (selectedLogTypes.length > 0 && !selectedLogTypes.includes(log.logType)) {
          return false;
      }

      // 3. Method Filter
      if (selectedMethods.length > 0 && !selectedMethods.includes(log.method)) {
          return false;
      }

      // 4. Status Class Filter
      if (selectedStatusClasses.length > 0) {
          let statusClass = '';
          if (log.logType === 'HTTP') {
            statusClass = Math.floor(log.status / 100) + 'xx';
          } else {
            statusClass = log.isError ? 'Error' : 'Success';
          }
          if (!selectedStatusClasses.includes(statusClass)) return false;
      }

      // 5. Latency Filter
      if (log.latency < minLat) return false;
      if (log.latency > maxLat) return false;

      // 6. Time Range
      if (timeCutoff > 0) {
          const logTime = new Date(log.timestamp).getTime();
          if (logTime < timeCutoff) return false;
      }

      return true;
    });
  }, [logs, filterText, selectedMethods, selectedStatusClasses, selectedLogTypes, minLatency, maxLatency, timeRange, latestTimestamp]);

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

  const toggleLogType = (type: string) => {
    setSelectedLogTypes(prev => 
      prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]
    );
  };

  const clearFilters = () => {
      setFilterText('');
      setSelectedLogTypes([]);
      setSelectedMethods([]);
      setSelectedStatusClasses([]);
      setMinLatency('');
      setMaxLatency('');
      setTimeRange('ALL');
  };

  const activeFilterCount = 
    (filterText ? 1 : 0) + 
    selectedLogTypes.length +
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
                        OmniTrace
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            SRE Command Center
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 pr-20">
                    {/* Tab Navigation */}
                    <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 mr-4">
                        {DASHBOARD_TABS.map(tab => (
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
                        onClick={handleCopyLink}
                        aria-label="Copy shareable link"
                        title="Copy link to this view"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm font-medium mr-3"
                    >
                        {copiedLink ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
                        <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
                    </button>

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

            {/* Mobile tab switcher */}
            <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-3 -mt-1" role="tablist" aria-label="Dashboard views">
                {DASHBOARD_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-label={`Switch to ${tab.label} dashboard view`}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all
                            ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}
                        `}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
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
                        
                         {/* Log Type Filter */}
                         <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Log Type</label>
                            <div className="flex items-center gap-2">
                                {['HTTP', 'DATABASE', 'SYSTEM', 'APP', 'UNKNOWN'].map((type) => {
                                    const isActive = selectedLogTypes.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => toggleLogType(type)}
                                            aria-label={`Toggle ${type} log type filter`}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                                                ${isActive ? (LOG_TYPE_ACTIVE[type] || INACTIVE_CHIP) : INACTIVE_CHIP}
                                            `}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
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
                                    placeholder="Search logs..."
                                    aria-label="Search logs by content or path"
                                    className="bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-200 w-32 md:w-48 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                         </div>

                         {/* Status Filter */}
                         <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Class</label>
                            <div className="flex items-center gap-2">
                                {['2xx', '3xx', '4xx', '5xx', 'Success', 'Error'].map((cls) => {
                                    const isActive = selectedStatusClasses.includes(cls);
                                    return (
                                        <button
                                            key={cls}
                                            onClick={() => toggleStatusClass(cls)}
                                            aria-label={`Toggle ${cls} status category filter`}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-xs font-mono border transition-all
                                                ${isActive ? (STATUS_ACTIVE[cls] || INACTIVE_CHIP) : INACTIVE_CHIP}
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
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard Overview</h2>
                    <button 
                        onClick={() => setEditMode(!editMode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            editMode 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <Settings size={16} />
                        {editMode ? 'Done Customizing' : 'Customize'}
                    </button>
                </div>

                {editMode && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-2 items-center">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">Add Widget:</span>
                        {WIDGET_OPTIONS.map(opt => (
                            <button
                                key={opt.type}
                                onClick={() => addWidget(opt.type as WidgetType)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-colors"
                            >
                                <Plus size={14} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {widgets.map(widget => (
                        <div 
                            key={widget.id} 
                            className={`bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 backdrop-blur-sm shadow-sm dark:shadow-xl flex flex-col pt-14 relative min-h-[350px] ${
                                widget.width === 3 ? 'md:col-span-2 lg:col-span-3' :
                                widget.width === 2 ? 'md:col-span-2 lg:col-span-2' : ''
                            }`}
                        >
                            {editMode && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-md border border-slate-200 dark:border-slate-700 z-10 backdrop-blur-sm">
                                    <button onClick={() => resizeWidget(widget.id, 1)} className={`p-1 rounded ${widget.width === 1 ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="1 Column Layout"><Minimize2 size={14} /></button>
                                    <button onClick={() => resizeWidget(widget.id, 2)} className={`p-1 rounded ${widget.width === 2 ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="2 Column Layout"><MoveRight size={14} /></button>
                                    <button onClick={() => resizeWidget(widget.id, 3)} className={`p-1 rounded ${widget.width === 3 ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="3 Column Layout"><Maximize2 size={14} /></button>
                                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                                    <button onClick={() => removeWidget(widget.id)} className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Remove Widget"><Trash2 size={14} /></button>
                                </div>
                            )}

                            <div className="absolute top-4 left-6 flex items-center justify-between right-6">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    {widget.type === 'TRAFFIC' && <><Activity className="w-5 h-5 text-blue-500" /> Traffic & Errors</>}
                                    {widget.type === 'STATUS' && <>Status Distribution</>}
                                    {widget.type === 'LATENCY' && <><BarChart2 size={16} className="text-blue-500" /> Latency</>}
                                    {widget.type === 'HEATMAP' && <><Zap className="w-5 h-5 text-yellow-500" /> Hourly Intensity</>}
                                    {widget.type === 'ENDPOINTS' && <>Slowest Endpoints / Commands</>}
                                </h3>
                            </div>

                            <div className="flex-1 flex flex-col relative w-full h-full min-h-[250px]">
                                {widget.type === 'TRAFFIC' && <TrafficChart data={stats} theme={settings.theme} />}
                                {widget.type === 'STATUS' && (
                                    <>
                                        <div className="flex-1 min-h-[0px]">
                                            <StatusDistribution 
                                              data={stats} 
                                              theme={settings.theme} 
                                              onStatusClick={(status) => {
                                                toggleStatusClass(status);
                                                setShowFilters(true);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                              }} 
                                            />
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-4 text-xs justify-center pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span><span>2xx / Success</span></div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span><span>3xx</span></div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span><span>4xx</span></div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span><span>5xx / Error</span></div>
                                        </div>
                                    </>
                                )}
                                {widget.type === 'LATENCY' && (
                                  <LatencyHistogram 
                                    data={stats} 
                                    theme={settings.theme} 
                                    onBarClick={(min, max) => {
                                      setMinLatency(min.toString());
                                      setMaxLatency(max.toString());
                                      setShowFilters(true);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} 
                                  />
                                )}
                                {widget.type === 'HEATMAP' && <HeatmapGrid data={stats} theme={settings.theme} />}
                                {widget.type === 'ENDPOINTS' && (
                                  <TopEndpointsChart 
                                    data={stats} 
                                    theme={settings.theme} 
                                    onEndpointClick={(path) => {
                                      setFilterText(path);
                                      setShowFilters(true);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} 
                                  />
                                )}
                            </div>
                        </div>
                    ))}

                    {widgets.length === 0 && (
                        <div className="col-span-full py-16 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                             <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mb-4">
                                <LayoutDashboard className="text-slate-500 dark:text-slate-400" />
                             </div>
                             <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">No widgets on the dashboard</h3>
                             <p className="text-slate-500 dark:text-slate-400 mb-6">Customize your dashboard by adding some widgets.</p>
                             <button onClick={() => setEditMode(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">Customize Dashboard</button>
                        </div>
                    )}
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