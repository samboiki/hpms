import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ChevronRight } from 'lucide-react';

interface StatItem {
  label: string;
  value: string | number;
  color?: string;
}

interface MiniChartData {
  type: 'line' | 'bar' | 'donut';
  data: number[];
  labels?: string[];
  colors?: string[];
}

interface PremiumStatCardProps {
  title: string;
  mainValue: string | number;
  subtitle: string;
  icon: LucideIcon;
  gradient: string;
  stats: StatItem[];
  miniChart?: MiniChartData;
  onClick: () => void;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

const PremiumStatCard: React.FC<PremiumStatCardProps> = ({
  title,
  mainValue,
  subtitle,
  icon: Icon,
  gradient,
  stats,
  miniChart,
  onClick,
  trend
}) => {
  const renderMiniChart = () => {
    if (!miniChart) return null;

    const maxValue = Math.max(...miniChart.data);
    const minValue = Math.min(...miniChart.data);

    switch (miniChart.type) {
      case 'line':
        return (
          <div className="mt-4">
            <div className="flex items-end justify-between h-8 relative">
              {/* Smooth line path */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 32" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="white" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="white" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                
                {/* Area fill */}
                <path
                  d={`M 0 32 ${miniChart.data.map((value, index) => {
                    const x = (index / (miniChart.data.length - 1)) * 100;
                    const y = 32 - ((value - minValue) / (maxValue - minValue)) * 24;
                    return `L ${x} ${y}`;
                  }).join(' ')} L 100 32 Z`}
                  fill="url(#areaGradient)"
                />
                
                {/* Line */}
                <path
                  d={`M ${miniChart.data.map((value, index) => {
                    const x = (index / (miniChart.data.length - 1)) * 100;
                    const y = 32 - ((value - minValue) / (maxValue - minValue)) * 24;
                    return index === 0 ? `${x} ${y}` : `L ${x} ${y}`;
                  }).join(' ')}`}
                  stroke="url(#lineGradient)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Glow effect */}
                <path
                  d={`M ${miniChart.data.map((value, index) => {
                    const x = (index / (miniChart.data.length - 1)) * 100;
                    const y = 32 - ((value - minValue) / (maxValue - minValue)) * 24;
                    return index === 0 ? `${x} ${y}` : `L ${x} ${y}`;
                  }).join(' ')}`}
                  stroke="white"
                  strokeWidth="4"
                  fill="none"
                  strokeOpacity="0.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="blur(1px)"
                />
              </svg>
              
              {/* Data points */}
              {miniChart.data.map((value, index) => {
                const height = ((value - minValue) / (maxValue - minValue)) * 75;
                return (
                  <div
                    key={index}
                    className="relative flex-1 flex justify-center"
                    style={{ height: '32px' }}
                  >
                    <div
                      className="absolute bottom-0 w-1 h-1 bg-white rounded-full shadow-lg opacity-80"
                      style={{ bottom: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      
      case 'bar':
        return (
          <div className="mt-4">
            <div className="flex items-end justify-between h-8 gap-0.5">
              {miniChart.data.map((value, index) => {
                const height = (value / maxValue) * 100;
                return (
                  <div
                    key={index}
                    className="relative flex-1 flex flex-col justify-end"
                  >
                    {/* Glow effect */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-sm opacity-20 blur-sm"
                      style={{ height: `${height}%` }}
                    />
                    {/* Main bar */}
                    <div
                      className="bg-gradient-to-t from-white/60 via-white/40 to-white/20 rounded-t-sm relative overflow-hidden"
                      style={{ height: `${height}%` }}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform skew-x-12 animate-pulse" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      
      case 'donut':
        const total = miniChart.data.reduce((sum, value) => sum + value, 0);
        let cumulativeAngle = 0;
        
        return (
          <div className="mt-3 flex justify-center">
            <div className="relative w-12 h-12">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge> 
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Background circle */}
                <circle
                  cx="21"
                  cy="21"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke="white"
                  strokeOpacity="0.1"
                  strokeWidth="2"
                />
                
                {/* Data segments */}
                {miniChart.data.map((value, index) => {
                  const angle = (value / total) * 360;
                  const strokeDasharray = `${(angle / 360) * 100} ${100 - (angle / 360) * 100}`;
                  const strokeDashoffset = -cumulativeAngle / 360 * 100;
                  cumulativeAngle += angle;
                  
                  return (
                    <circle
                      key={index}
                      cx="21"
                      cy="21"
                      r="15.91549430918954"
                      fill="transparent"
                      stroke="white"
                      strokeOpacity={0.9 - index * 0.15}
                      strokeWidth="2"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      filter="url(#glow)"
                    />
                  );
                })}
              </svg>
              
              {/* Center value */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white/80">{total}</span>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      {/* Main card - compact and borderless */}
      <div className={`relative bg-gradient-to-br ${gradient} rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 overflow-hidden`}>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        
        <div className="relative p-4">
          {/* Compact header */}
          <div className="flex items-center justify-between mb-3">
            <div className="relative">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {trend && (
                <div className="text-xs text-white/80 font-medium">
                  <span className="opacity-60">{trend.isPositive ? '↗' : '↘'}</span>
                  <span className="ml-1">{trend.value}</span>
                </div>
              )}
              <ChevronRight className="w-3 h-3 text-white/60 group-hover:text-white/80 transition-colors" />
            </div>
          </div>
          
          {/* Main content - more compact */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">{title}</p>
              <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-xs text-white/80">{subtitle}</p>
            </div>

            {/* Compact stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {stats.slice(0, 4).map((stat, index) => (
                <div key={index} className="text-center bg-white/10 rounded-lg py-1 px-2 backdrop-blur-sm">
                  <p className="text-xs font-bold text-white">
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-white/70 font-medium leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Enhanced mini chart */}
            {miniChart && renderMiniChart()}
          </div>
          
          {/* Subtle bottom accent */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/20 via-white/40 to-white/20 opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;