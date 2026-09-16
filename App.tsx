import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import About from './components/About';
import { parseLogsInWorker } from './engine/client';
import { clearSession, loadSession, saveSession } from './engine/store';
import {
  ProcessedLogEntry,
  AppSettings,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  persistableSettings,
} from './types';
import { Settings, HelpCircle, ArrowLeft } from 'lucide-react';

function App() {
  const [logs, setLogs] = useState<ProcessedLogEntry[] | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<'HOME' | 'ABOUT'>('HOME');
  const [ready, setReady] = useState(false);
  const lineOffsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then((saved) => {
        if (cancelled || !saved?.length) return;
        setLogs(saved);
        lineOffsetRef.current = saved.length;
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!logs) {
      void clearSession();
      return;
    }
    const timer = window.setTimeout(() => {
      void saveSession(logs);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [logs, ready]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(persistableSettings(settings)));
  }, [settings]);

  const handleDataLoaded = useCallback(async (content: string, isAppend: boolean = false) => {
    if (!isAppend) lineOffsetRef.current = 0;
    const startIndex = lineOffsetRef.current;
    const lineCount = content.split(/\r?\n/).filter((l) => l.trim() !== '').length;
    const parsedLogs = await parseLogsInWorker(content, { startIndex });
    lineOffsetRef.current = startIndex + lineCount;

    setLogs((prev) => {
      if (isAppend && prev) {
        const newLogs = [...prev, ...parsedLogs];
        return newLogs.length > 10000 ? newLogs.slice(-10000) : newLogs;
      }
      return parsedLogs.length > 10000 ? parsedLogs.slice(-10000) : parsedLogs;
    });
  }, []);

  const handleReset = () => {
    setLogs(null);
    lineOffsetRef.current = 0;
    void clearSession();
  };

  const TopBar = () => (
    <div className="absolute top-4 right-4 z-50 flex gap-2">
      <button
        onClick={() => setCurrentView(currentView === 'ABOUT' ? 'HOME' : 'ABOUT')}
        className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
        title={currentView === 'ABOUT' ? 'Back to App' : 'Help & About'}
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
        <SettingsModal settings={settings} onUpdate={setSettings} onClose={() => setShowSettings(false)} />
      )}

      {currentView === 'ABOUT' ? (
        <About />
      ) : !ready ? (
        <div className="min-h-screen flex items-center justify-center text-slate-500" data-testid="boot">
          Restoring session…
        </div>
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
