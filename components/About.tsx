import React from 'react';
import { FileText, Terminal, BookOpen, CheckCircle, Copy } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">About LogPulse</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          A client-side, privacy-first log analysis tool for SREs and Developers.
        </p>
      </div>

      {/* Guide */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-slate-800 dark:text-slate-100">
            <BookOpen className="text-blue-500" />
            How to Collect Logs
        </h2>
        <div className="space-y-6">
            <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">1</div>
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Export your logs</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Use your command line to dump logs to a file. We support `.log`, `.txt`, `.json`, `.csv`, `.tsv`, and compressed `.gz` or `.zip` files.
                    </p>
                    <div className="mt-3 bg-slate-100 dark:bg-slate-900 p-4 rounded-lg font-mono text-sm overflow-x-auto text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <p className="opacity-50 mb-2"># Kubernetes</p>
                        <p>kubectl logs -l app=my-app > logs.txt</p>
                        <p className="opacity-50 mt-3 mb-2"># Docker</p>
                        <p>docker logs my-container > logs.txt</p>
                        <p className="opacity-50 mt-3 mb-2"># GCP</p>
                        <p>gcloud logging read "resource.type=k8s_container" --limit=1000 --format=json > logs.json</p>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">2</div>
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Upload to LogPulse</h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Drag and drop the file into the LogPulse upload area. The processing happens entirely in your browser memory; no data leaves your device.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* Formats */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-slate-800 dark:text-slate-100">
            <FileText className="text-emerald-500" />
            Supported Log Formats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
                { 
                    title: 'JSON Lines (GCP/Zap)', 
                    desc: 'Standard structured logging format used by Google Cloud, Bunyan, and Zap.',
                    example: '{"timestamp": "...", "severity": "INFO", "message": "..."}'
                },
                { 
                    title: 'Nginx / Apache CLF', 
                    desc: 'Common Log Format (CLF) and Combined Log Format.',
                    example: '127.0.0.1 - - [10/Oct/2023:13:55:36] "GET / HTTP/1.1" 200 ...'
                },
                { 
                    title: 'Kubernetes (CRI)', 
                    desc: 'Standard output from klog/kubectl.',
                    example: '2023-10-10T13:55:36Z stdout F I0110 ...'
                },
                { 
                    title: 'PostgreSQL', 
                    desc: 'Standard Postgres server logs with duration.',
                    example: '2023-10-10 13:55:36 UTC [123] LOG: duration: 50.0 ms ...'
                },
                { 
                    title: 'Envoy Access Logs', 
                    desc: 'Default Envoy Proxy access log format.',
                    example: '[2023-10-10T13:55:36Z] "GET /path HTTP/1.1" 200 ...'
                },
                 { 
                    title: 'Redis', 
                    desc: 'Redis server logs.',
                    example: '1:M 10 Oct 2023 13:55:36.123 * DB saved on disk'
                }
            ].map(fmt => (
                <div key={fmt.title} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{fmt.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-2">{fmt.desc}</p>
                    <code className="block bg-white dark:bg-black/20 p-2 rounded text-xs font-mono text-slate-600 dark:text-slate-300 break-all">
                        {fmt.example}
                    </code>
                </div>
            ))}
        </div>
      </section>

      {/* Footer */}
      <div className="text-center pt-8 border-t border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 text-sm">
            LogPulse Version 1.2.0 &bull; Built with React, Tailwind & Google GenAI / Ollama
        </p>
      </div>

    </div>
  );
};

export default About;