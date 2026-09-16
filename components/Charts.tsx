import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { AggregatedStats } from '../types';

interface ChartsProps {
  data: AggregatedStats;
  theme: 'light' | 'dark';
}

const CustomTooltip = ({ active, payload, label, theme }: any) => {
  if (active && payload && payload.length) {
    const bgClass = theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
    const textClass = theme === 'dark' ? 'text-slate-200' : 'text-slate-800';
    const subTextClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

    return (
      <div className={`${bgClass} border p-3 rounded shadow-xl z-50`}>
        <p className={`${subTextClass} text-sm mb-2 font-bold border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'} pb-1`}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className={`${subTextClass} capitalize`}>{entry.name}:</span>
            <span className={`${textClass} font-mono`}>
                {typeof entry.value === 'number' && (entry.name.includes('Latency') || entry.name.includes('ms'))
                    ? entry.value.toFixed(2) + 'ms' 
                    : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const TrafficChart: React.FC<ChartsProps> = ({ data, theme }) => {
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data.requestsOverTime}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke={axisColor}
            tickFormatter={(str) => {
              if (typeof str === 'string' && str.includes(' ')) {
                return str.split(' ')[1];
              }
              return str;
            }}
            tick={{fontSize: 12}}
            minTickGap={30}
          />
          <YAxis yAxisId="left" stroke={axisColor} tick={{fontSize: 12}} />
          <YAxis yAxisId="right" orientation="right" stroke="#10b981" unit="ms" tick={{fontSize: 12}} />
          <Tooltip content={<CustomTooltip theme={theme} />} />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="count"
            name="Requests"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorCount)"
            strokeWidth={2}
          />
           <Area
            yAxisId="left"
            type="monotone"
            dataKey="errorCount"
            name="Errors"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorError)"
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgLatency"
            name="Avg Latency"
            stroke="#10b981"
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export const StatusDistribution: React.FC<ChartsProps & { onStatusClick?: (status: string) => void }> = ({ data, theme, onStatusClick }) => {
  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.statusDistribution}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            onClick={(data) => {
              if (onStatusClick && data && data.name) {
                onStatusClick(data.name);
              }
            }}
            className={onStatusClick ? "cursor-pointer outline-none hover:opacity-80 transition-opacity" : "outline-none"}
          >
            {data.statusDistribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0)" style={{ outline: 'none' }} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip theme={theme} />} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TopEndpointsChart: React.FC<ChartsProps & { onEndpointClick?: (path: string) => void }> = ({ data, theme, onEndpointClick }) => {
  const chartData = data.topEndpoints.slice(0, 5).map(e => ({
      ...e,
      shortPath: e.path.length > 30 ? '...' + e.path.slice(-30) : e.path
  }));
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
          <XAxis type="number" stroke={axisColor} />
          <YAxis 
            type="category" 
            dataKey="shortPath" 
            stroke={axisColor} 
            width={150} 
            tick={{fontSize: 11}}
          />
          <Tooltip content={<CustomTooltip theme={theme} />} cursor={{fill: theme === 'dark' ? '#1e293b' : '#f1f5f9'}} />
          <Legend />
          <Bar 
            dataKey="count" 
            name="Volume" 
            fill="#8b5cf6" 
            radius={[0, 4, 4, 0]} 
            barSize={20}
            onClick={(data) => {
              if (onEndpointClick && data && data.path) {
                onEndpointClick(data.path);
              }
            }}
            className={onEndpointClick ? "cursor-pointer" : ""}
          />
          <Bar dataKey="avgLatency" name="Latency (ms)" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const LatencyHistogram: React.FC<ChartsProps & { onBarClick?: (min: number, max: number) => void }> = ({ data, theme, onBarClick }) => {
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';

  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.latencyHistogram} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="range" stroke={axisColor} tick={{fontSize: 10}} interval={2} />
          <YAxis stroke={axisColor} tick={{fontSize: 10}} />
          <Tooltip content={<CustomTooltip theme={theme} />} cursor={{fill: theme === 'dark' ? '#1e293b' : '#f1f5f9'}} />
          <Bar 
            dataKey="count" 
            name="Request Count" 
            fill="#3b82f6" 
            radius={[2, 2, 0, 0]}
            onClick={(data) => {
              if (onBarClick && data && data.range) {
                const parts = data.range.replace('ms', '').split('-');
                if (parts.length === 2) {
                  onBarClick(parseFloat(parts[0]), parseFloat(parts[1]));
                }
              }
            }}
            className={onBarClick ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HeatmapGrid: React.FC<ChartsProps> = ({ data, theme }) => {
  const maxCount = Math.max(...data.trafficHeatmap.map(d => d.count)) || 1;
  
  return (
    <div className="w-full h-full flex flex-col justify-between">
       <div className="flex justify-between items-end h-[200px] gap-1">
           {data.trafficHeatmap.map((d) => {
               const intensity = d.count / maxCount;
               const hasErrors = d.errorRate > 0.05;
               const bgClass = hasErrors ? 'bg-red-500' : 'bg-cyan-500';
               const opacity = Math.max(0.2, intensity);
               
               return (
                   <div key={d.hour} className="flex-1 flex flex-col items-center group relative">
                       {/* Tooltip on hover */}
                       <div className={`absolute bottom-full mb-2 hidden group-hover:block z-20 ${theme === 'dark' ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-white text-slate-800 border-slate-200'} text-xs p-2 rounded border whitespace-nowrap shadow-xl`}>
                           <div className="font-bold">{d.hour}:00 - {d.hour}:59</div>
                           <div>Requests: {d.count}</div>
                           <div className={d.errorRate > 0 ? 'text-red-400' : (theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
                               Error Rate: {(d.errorRate * 100).toFixed(1)}%
                           </div>
                       </div>
                       
                       {/* Bar */}
                       <div 
                         className={`w-full rounded-t-sm transition-all hover:brightness-125 ${bgClass}`}
                         style={{ 
                             height: `${Math.max(5, intensity * 100)}%`,
                             opacity: opacity
                         }}
                       />
                   </div>
               )
           })}
       </div>
       <div className={`flex justify-between mt-2 text-[10px] ${theme === 'dark' ? 'text-slate-500 border-slate-700' : 'text-slate-400 border-slate-200'} border-t pt-1`}>
           {data.trafficHeatmap.filter((_, i) => i % 3 === 0).map(d => (
               <span key={d.hour}>{d.hour}:00</span>
           ))}
       </div>
    </div>
  );
};