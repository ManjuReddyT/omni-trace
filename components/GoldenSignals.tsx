import React from 'react';
import { GoldenSignals as IGoldenSignals } from '../types';
import { Activity, Clock, AlertOctagon, BatteryCharging } from 'lucide-react';

interface Props {
  data: IGoldenSignals;
}

const SignalCard = ({ label, value, unit, icon: Icon, color, detail }: any) => (
  <div className={`bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-start gap-4 relative overflow-hidden group hover:border-${color}-500/50 transition-all shadow-sm dark:shadow-none`}>
    <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 group-hover:bg-${color}-200 dark:group-hover:bg-${color}-500/20 transition-colors`}>
      <Icon size={24} />
    </div>
    <div className="z-10">
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-mono font-bold text-slate-800 dark:text-slate-100">{value}</span>
        <span className="text-sm text-slate-500 font-mono">{unit}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </div>
    {/* Decorative glow - only visible in dark mode primarily, subtle in light */}
    <div className={`absolute -right-6 -bottom-6 w-24 h-24 bg-${color}-500/5 rounded-full blur-2xl group-hover:bg-${color}-500/10 transition-all`} />
  </div>
);

const GoldenSignals: React.FC<Props> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SignalCard 
        label="Latency (P95)" 
        value={data.latency.toFixed(0)} 
        unit="ms" 
        icon={Clock} 
        color="amber"
        detail="Time it takes to serve a request"
      />
      <SignalCard 
        label="Traffic" 
        value={data.traffic.toFixed(1)} 
        unit="req/s" 
        icon={Activity} 
        color="blue"
        detail="Demand placed on the system"
      />
      <SignalCard 
        label="Errors" 
        value={data.errors.toFixed(2)} 
        unit="%" 
        icon={AlertOctagon} 
        color="red"
        detail="Rate of request failures"
      />
      <SignalCard 
        label="Saturation" 
        value={data.saturation.toFixed(0)} 
        unit="%" 
        icon={BatteryCharging} 
        color="purple"
        detail="Estimated system capacity usage"
      />
    </div>
  );
};

export default GoldenSignals;