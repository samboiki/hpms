import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { useTheme } from '../../stores/themeStore';

interface StatItem {
  label: string;
  value: string | number;
  color?: string;
}

interface ComparisonData {
  label1: string;
  value1: number;
  label2: string;
  value2: number;
  color1: string;
  color2: string;
}

interface PremiumStatCardProps {
  title: string;
  mainValue: string | number;
  subtitle: string;
  icon: LucideIcon;
  gradient: string;
  stats: StatItem[];
  comparison?: ComparisonData;
  onClick: () => void;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  unsplashQuery?: string;
}

const PremiumStatCard: React.FC<PremiumStatCardProps> = ({
  title,
  mainValue,
  subtitle,
  icon: Icon,
  gradient,
  stats,
  comparison,
  onClick,
  trend,
  unsplashQuery
}) => {
  const { currentTheme } = useTheme();
  const renderComparisonChart = () => {
    if (!comparison) return null;

    const total = comparison.value1 + comparison.value2;
    const percentage1 = total > 0 ? (comparison.value1 / total) * 100 : 0;
    const percentage2 = total > 0 ? (comparison.value2 / total) * 100 : 0;

    return (
      <div className="mt-4">
        {/* Premium comparison bar with sophisticated styling */}
        <div className="relative h-2.5 bg-gradient-to-r from-slate-200/60 via-slate-100/80 to-slate-200/60 rounded-full overflow-hidden mb-3 backdrop-blur-sm border border-white/30 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage1}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-slate-400/80 to-slate-500/60 shadow-sm"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage2}%` }}
            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
            className="absolute right-0 top-0 h-full bg-gradient-to-r from-slate-600/60 to-slate-700/80 shadow-sm"
          />
        </div>
        
        {/* Elegant labels with premium styling */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 bg-white/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/30">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-slate-400 to-slate-500 shadow-sm" />
            <span className="font-medium text-slate-700" style={{ fontFamily: 'Rubik, sans-serif' }}>{comparison.label1}</span>
            <span className="text-slate-600 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>{percentage1.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center gap-2 bg-white/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/30">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 shadow-sm" />
            <span className="font-medium text-slate-700" style={{ fontFamily: 'Rubik, sans-serif' }}>{comparison.label2}</span>
            <span className="text-slate-600 font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>{percentage2.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    );
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
      {/* Premium Grey Glass Morphism Card */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-100/95 via-gray-50/90 to-slate-200/95 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-white/40 group-hover:shadow-[0_35px_80px_-15px_rgba(0,0,0,0.35)] transition-all duration-500 overflow-hidden">
        {/* Sophisticated background pattern */}
        <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-500">
          <div className="absolute top-6 right-6">
            <Icon className="w-20 h-20 text-slate-700" />
          </div>
          {/* Subtle grid pattern */}
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(100,116,139,0.15) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>
        
        {/* Premium glass reflection */}
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
        
        {/* Elegant bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent"></div>
        
        {/* Subtle side borders */}
        <div className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>
        <div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>
        
        <div className="relative p-5 z-10">
          {/* Premium header with sophisticated styling */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-slate-200/60 via-white/80 to-slate-100/60 backdrop-blur-sm rounded-xl shadow-lg border border-white/60 group-hover:from-slate-300/60 group-hover:to-slate-200/60 transition-all duration-300">
                <Icon className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {title}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {trend && (
                <div className="text-xs text-slate-600 font-medium bg-white/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/30">
                  <span className={`${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {trend.isPositive ? '↗' : '↘'}
                  </span>
                  <span className="ml-1">{trend.value}</span>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
            </div>
          </div>
          
          {/* Main content with premium typography */}
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-slate-900 mb-2 tracking-tight" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-sm text-slate-600 font-medium leading-relaxed" style={{ fontFamily: 'Rubik, sans-serif' }}>{subtitle}</p>
            </div>

            {/* Premium stats grid with sophisticated styling */}
            <div className="grid grid-cols-2 gap-3">
              {stats.slice(0, 4).map((stat, index) => (
                <div 
                  key={index} 
                  className="text-center rounded-xl py-3 px-3 bg-gradient-to-br from-white/60 via-slate-50/40 to-white/30 backdrop-blur-md border border-white/50 hover:from-white/70 hover:via-slate-50/50 hover:to-white/40 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group/stat"
                >
                  <p className="text-sm font-bold text-slate-800 group-hover/stat:text-slate-900 transition-colors" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium leading-tight mt-1 group-hover/stat:text-slate-700 transition-colors" style={{ fontFamily: 'Rubik, sans-serif' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Compact comparison chart */}
            {renderComparisonChart()}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;