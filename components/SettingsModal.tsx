import React from 'react';
import { X, Moon, Sun, Cpu, Key, Globe, Database } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  const handleChange = (key: keyof AppSettings, value: string) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Settings
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          
          {/* Appearance Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Sun size={14} /> Appearance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleChange('theme', 'light')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  settings.theme === 'light' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Sun size={24} />
                <span className="font-medium">Light Mode</span>
              </button>
              <button
                onClick={() => handleChange('theme', 'dark')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  settings.theme === 'dark' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Moon size={24} />
                <span className="font-medium">Dark Mode</span>
              </button>
            </div>
          </section>

          {/* AI Configuration Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={14} /> AI Intelligence
            </h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provider</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => handleChange('aiProvider', 'gemini')}
                  className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    settings.aiProvider === 'gemini' 
                      ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => handleChange('aiProvider', 'ollama')}
                  className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    settings.aiProvider === 'ollama' 
                      ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Ollama (Local)
                </button>
              </div>
            </div>

            {settings.aiProvider === 'gemini' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                   <Key size={14} /> API Key
                 </label>
                 <input 
                    type="password"
                    value={settings.geminiKey}
                    onChange={(e) => handleChange('geminiKey', e.target.value)}
                    placeholder="Enter Google GenAI API Key"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                 />
                 <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                    Gemini runs in the cloud. Aggregated stats and log patterns leave this browser. The API key is kept in memory for this tab only — it is never written to localStorage.
                 </p>
              </div>
            )}

            {settings.aiProvider === 'ollama' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Globe size={14} /> Server URL
                    </label>
                    <input 
                        type="text"
                        value={settings.ollamaUrl}
                        onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Database size={14} /> Model Name
                    </label>
                    <input 
                        type="text"
                        value={settings.ollamaModel}
                        onChange={(e) => handleChange('ollamaModel', e.target.value)}
                        placeholder="llama3, mistral, etc."
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>
              </div>
            )}
          </section>

        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;