import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User, Settings2 } from 'lucide-react';
import { AggregatedStats, AppSettings } from '../types';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

interface FilterContext {
  filterText: string;
  selectedMethods: string[];
  selectedStatusClasses: string[];
  minLatency: string;
  maxLatency: string;
  timeRange: string;
}

interface Props {
  stats: AggregatedStats;
  filters?: FilterContext;
  settings: AppSettings;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIInsights: React.FC<Props> = ({ stats, filters, settings }) => {
  const [input, setInput] = useState('');
  
  const [messages, setMessages] = useState<Message[]>(() => [{
      role: 'assistant',
      content: `I've analyzed the ${stats.totalRequests} logs in your current view.

**Quick Summary:**
• **Error Rate:** ${stats.errorRate.toFixed(2)}%
• **Avg Latency:** ${stats.avgLatency.toFixed(0)}ms
• **P95 Latency:** ${stats.p95Latency.toFixed(0)}ms
${stats.anomalies.length > 0 ? `• **Anomalies:** ${stats.anomalies.length} outliers detected` : ''}

Using Provider: **${settings.aiProvider === 'gemini' ? 'Google Gemini' : `Ollama (${settings.ollamaModel})`}**
`
  }]);

  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Update notification on filter change
  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      const timer = setTimeout(() => {
          setMessages(prev => [
              ...prev,
              {
                  role: 'assistant',
                  content: `🔄 **View Updated**
New context: ${stats.totalRequests} requests, ${stats.errorRate.toFixed(2)}% errors, ${stats.avgLatency.toFixed(0)}ms latency.`
              }
          ]);
      }, 800);
      return () => clearTimeout(timer);
  }, [stats]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    const currentMessages = [...messages];
    setMessages([...currentMessages, { role: 'user', content: userMsg }]);
    setInput('');
    setIsProcessing(true);

    try {
        let filterContextStr = '';
        if (filters && (filters.selectedMethods.length || filters.selectedStatusClasses.length || filters.filterText)) {
            const methods = filters.selectedMethods.length > 0 ? filters.selectedMethods.join(', ') : 'All';
            const statuses = filters.selectedStatusClasses.length > 0 ? filters.selectedStatusClasses.join(', ') : 'All';
            const latency = `${filters.minLatency || '0'}ms - ${filters.maxLatency || '∞'}ms`;
            
            filterContextStr = `
Active View Filters: Time: ${filters.timeRange}, Query: "${filters.filterText || 'None'}", Methods: ${methods}, Status: ${statuses}, Latency: ${latency}`;
        }

        const systemContext = `You are an SRE expert analyzing server logs.
${filterContextStr}
System Stats (Computed from Filtered View):
- Total Requests: ${stats.totalRequests}
- Error Rate: ${stats.errorRate.toFixed(2)}%
- Avg Latency: ${stats.avgLatency.toFixed(2)}ms
- P95 Latency: ${stats.p95Latency.toFixed(2)}ms
- Top Endpoints: ${stats.topEndpoints.slice(0, 5).map(e => `${e.path} (${e.errorRate.toFixed(1)}% errors)`).join(', ')}
- Significant Patterns: ${stats.clusters.slice(0, 3).map(c => c.template).join('\n')}

Always answer concisely and accurately.`;

        // Add an empty assistant message to stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        if (settings.aiProvider === 'ollama') {
            const payload = {
                model: settings.ollamaModel,
                messages: [
                    { role: 'system', content: systemContext },
                    ...currentMessages.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: userMsg }
                ],
                stream: true
            };

            const baseUrl = settings.ollamaUrl.replace(/\/+$/, '');
            const res = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error(`Ollama Error: ${res.status} ${res.statusText}`);
            if (!res.body) throw new Error('No response body from Ollama');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunkStr = decoder.decode(value, { stream: true });
                    const lines = chunkStr.split('\n');
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.message?.content) {
                                accumulatedText += data.message.content;
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1] = { role: 'assistant', content: accumulatedText };
                                    return newMsgs;
                                });
                            }
                        } catch (e) {
                            console.error("Error parsing Ollama stream chunk", e, line);
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

        } else {
            // Gemini Streaming
            const key = settings.geminiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
            if (!key) throw new Error("No Gemini API Key found in settings or environment.");
            
            const ai = new GoogleGenAI({ apiKey: key });
            
            const geminiMessages = [
                { role: 'user', parts: [{ text: systemContext }] },
                { role: 'model', parts: [{ text: "Understood. I have the context and am ready to answer queries as an SRE expert." }] },
                ...currentMessages.filter(m => m.content.trim()).map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                })),
                { role: 'user', parts: [{ text: userMsg }] }
            ];

            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: geminiMessages
            });

            let accumulatedText = '';
            for await (const chunk of responseStream) {
                if (chunk.text) {
                    accumulatedText += chunk.text;
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = { role: 'assistant', content: accumulatedText };
                        return newMsgs;
                    });
                }
            }
        }
    } catch (e: any) {
        console.error("AI Error", e);
        setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'assistant', content: `Error: ${e.message}` };
            return newMsgs;
        });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="h-[600px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xl relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-indigo-900 dark:to-slate-900 p-4 border-b border-slate-200 dark:border-indigo-500/30 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-indigo-500/20 rounded-lg">
                <Sparkles size={20} className="text-blue-600 dark:text-indigo-400" />
            </div>
            <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">AI Investigator</h3>
                <p className="text-xs text-slate-500 dark:text-indigo-300 flex items-center gap-1">
                    Via {settings.aiProvider === 'ollama' ? 'Ollama' : 'Gemini'}
                </p>
            </div>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#0a0f1e]">
        {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 border border-blue-200 dark:border-indigo-500/30">
                        <Bot size={16} className="text-blue-600 dark:text-indigo-400" />
                    </div>
                )}
                <div className={`
                    max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'}
                `}>
                    <ReactMarkdown 
                        components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                            strong: ({node, ...props}) => <span className={`font-bold ${msg.role === 'user' ? 'text-white' : 'text-slate-900 dark:text-white'}`} {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-300 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                            code: ({node, className, children, ...props}: any) => {
                                return (
                                    <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-mono text-xs border border-slate-200 dark:border-slate-700/50" {...props}>
                                        {children}
                                    </code>
                                )
                            },
                            pre: ({node, children, ...props}) => (
                                <pre className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg overflow-x-auto my-2 border border-slate-200 dark:border-slate-700/50" {...props}>
                                    {children}
                                </pre>
                            )
                        }}
                    >
                        {msg.content}
                    </ReactMarkdown>
                </div>
                {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <User size={16} className="text-slate-600 dark:text-slate-300" />
                    </div>
                )}
            </div>
        ))}
        {isProcessing && (
             <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 border border-blue-200 dark:border-indigo-500/30">
                    <Bot size={16} className="text-blue-600 dark:text-indigo-400" />
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 dark:bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                    <span className="w-2 h-2 bg-blue-400 dark:bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                    <span className="w-2 h-2 bg-blue-400 dark:bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                </div>
             </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <div className="relative">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={`Ask ${settings.aiProvider === 'ollama' ? 'Llama' : 'Gemini'} about errors, patterns...`}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner text-slate-800 dark:text-slate-200"
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 rounded-lg text-white transition-colors"
            >
                <Send size={16} />
            </button>
        </div>
        <div className="flex gap-2 mt-2 justify-center">
            {['Explain the error spike', 'Show 5xx analysis', 'Summarize traffic'].map(suggestion => (
                <button 
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-400 transition-colors"
                >
                    {suggestion}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AIInsights;