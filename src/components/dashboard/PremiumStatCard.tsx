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

    switch (miniChart.type) {
      case 'line':
        return (
          <div className="flex items-end justify-between h-12 mt-3">
            {miniChart.data.map((value, index) => {
              const height = (value / Math.max(...miniChart.data)) * 100;
              return (
                <div
                  key={index}
                  className="bg-gradient-to-t from-white/30 to-white/10 rounded-sm flex-1 mx-0.5"
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        );
      
      case 'bar':
        return (
          <div className="flex items-end justify-between h-12 mt-3 gap-1">
            {miniChart.data.map((value, index) => {
              const height = (value / Math.max(...miniChart.data)) * 100;
              return (
                <div
                  key={index}
                  className="bg-white/20 rounded-sm flex-1"
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        );
      
      case 'donut':
        const total = miniChart.data.reduce((sum, value) => sum + value, 0);
        let cumulativeAngle = 0;
        
        return (
          <div className="relative w-16 h-16 mt-2">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
              <circle
                cx="21"
                cy="21"
                r="15.91549430918954"
                fill="transparent"
                stroke="white"
                strokeOpacity="0.1"
                strokeWidth="3"
              />
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
                    strokeOpacity={0.8 - index * 0.2}
                    strokeWidth="3"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
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
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      {/* Background gradient glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500 opacity-90`}></div>
      
      {/* Main card */}
      <div className={`relative bg-gradient-to-br ${gradient} rounded-3xl p-1 shadow-2xl transition-all duration-500 group-hover:shadow-3xl`}>
        <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
          
          <div className="relative p-6">
            {/* Header with icon and trend */}
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} blur-xl opacity-50 transition-all duration-500`}></div>
                <div className={`relative p-3 bg-gradient-to-br ${gradient} rounded-2xl shadow-lg transition-all duration-500`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {trend && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                    trend.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span>{trend.isPositive ? '↗' : '↘'}</span>
                    <span>{trend.value}</span>
                  </div>
                )}
                <div className="flex items-center text-gray-400 group-hover:text-gray-600 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            {/* Main content */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
                <p className="text-3xl font-black text-gray-900 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {mainValue}
                </p>
                <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
              </div>

              {/* Stats breakdown */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <p className="text-sm font-bold text-gray-900" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Mini chart */}
              {miniChart && (
                <div className="pt-2">
                  {renderMiniChart()}
                </div>
              )}
            </div>
            
            {/* Bottom accent gradient */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient.replace('from-', 'from-').replace('to-', 'to-')} opacity-60 group-hover:opacity-100 transition-opacity duration-300`}></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;