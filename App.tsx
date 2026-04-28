import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import About from './components/About';
import { parseLogs } from './utils';
import { ProcessedLogEntry, AppSettings, DEFAULT_SETTINGS } from './types';
import { Settings, HelpCircle, ArrowLeft } from 'lucide-react';

function App() {
  const [logs, setLogs] = useState<ProcessedLogEntry[] | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Try to load from local storage
    const saved = localStorage.getItem('logpulse_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<'HOME' | 'ABOUT'>('HOME');

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    localStorage.setItem('logpulse_settings', JSON.stringify(settings));
  }, [settings]);

  const handleDataLoaded = useCallback((content: string, isAppend: boolean = false) => {
    const parsedLogs = parseLogs(content);
    setLogs(prev => {
        if (isAppend && prev) {
            const newLogs = [...prev, ...parsedLogs];
            return newLogs.length > 10000 ? newLogs.slice(-10000) : newLogs;
        }
        return parsedLogs.length > 10000 ? parsedLogs.slice(-10000) : parsedLogs;
    });
  }, []);

  const handleReset = () => {
    setLogs(null);
  };

  const TopBar = () => (
     <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button 
            onClick={() => setCurrentView(currentView === 'ABOUT' ? 'HOME' : 'ABOUT')}
            className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title={currentView === 'ABOUT' ? "Back to App" : "Help & About"}
        >
            {currentView === 'ABOUT' ? <ArrowLeft size={20} /> : <HelpCircle size={20} />}
        </button>
        <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Settings"
        >
            <Settings size={20} />
        </button>
     </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-200 transition-colors duration-300 relative">
      <TopBar />
      
      {showSettings && (
        <SettingsModal 
            settings={settings} 
            onUpdate={setSettings} 
            onClose={() => setShowSettings(false)} 
        />
      )}

      {currentView === 'ABOUT' ? (
        <About />
      ) : (
        <>
            {logs ? (
                <Dashboard logs={logs} onReset={handleReset} settings={settings} />
            ) : (
                <FileUpload onDataLoaded={handleDataLoaded} />
            )}
        </>
      )}
    </div>
  );
}

export default App;