import React from 'react';
import { GoldenSignals as IGoldenSignals } from '../types';
import { Activity, Clock, AlertOctagon, BatteryCharging, LucideIcon } from 'lucide-react';

interface Props {
  data: IGoldenSignals;
}

const COLOR_STYLES: Record<string, { card: string; icon: string; glow: string }> = {
  amber: {
    card: 'hover:border-amber-500/50',
    icon: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 group-hover:bg-amber-200 dark:group-hover:bg-amber-500/20',
    glow: 'bg-amber-500/5 group-hover:bg-amber-500/10',
  },
  blue: {
    card: 'hover:border-blue-500/50',
    icon: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20',
    glow: 'bg-blue-500/5 group-hover:bg-blue-500/10',
  },
  red: {
    card: 'hover:border-red-500/50',
    icon: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500 group-hover:bg-red-200 dark:group-hover:bg-red-500/20',
    glow: 'bg-red-500/5 group-hover:bg-red-500/10',
  },
  purple: {
    card: 'hover:border-purple-500/50',
    icon: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 group-hover:bg-purple-200 dark:group-hover:bg-purple-500/20',
    glow: 'bg-purple-500/5 group-hover:bg-purple-500/10',
  },
};

const SignalCard = ({
  label,
  value,
  unit,
  icon: Icon,
  color,
  detail,
}: {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  color: keyof typeof COLOR_STYLES;
  detail: string;
}) => {
  const styles = COLOR_STYLES[color];
  return (
    <div className={`bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-start gap-4 relative overflow-hidden group ${styles.card} transition-all shadow-sm dark:shadow-none`}>
      <div className={`p-3 rounded-lg ${styles.icon} transition-colors`}>
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
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 ${styles.glow} rounded-full blur-2xl transition-all`} />
    </div>
  );
};

const GoldenSignals: React.FC<Props> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="golden-signals">
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
        detail="Occupancy × errors × p95/p50 (not raw req/s)"
      />
    </div>
  );
};

export default GoldenSignals;
