import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  colorClass: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, subValue, icon: Icon, colorClass }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-xl p-6 flex flex-col justify-between hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg bg-opacity-20 ${colorClass.replace('text-', 'bg-')}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold text-slate-100">{value}</div>
        {subValue && (
          <div className="text-sm text-slate-500 mt-1 font-medium">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;