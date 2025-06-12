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
      <div className="mt-3">
        {/* Compact Horizontal Stacked Bar with glass morphism */}
        <div className="relative h-2 bg-white/20 rounded-full overflow-hidden mb-2 backdrop-blur-sm">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage1}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full bg-white/40"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage2}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-0 h-full bg-white/60"
          />
        </div>
        
        {/* Compact Labels in Single Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <span className="font-medium text-white/90" style={{ fontFamily: 'Rubik, sans-serif' }}>{comparison.label1}</span>
            <span className="text-white/70" style={{ fontFamily: 'Rubik, sans-serif' }}>{percentage1.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <span className="font-medium text-white/90" style={{ fontFamily: 'Rubik, sans-serif' }}>{comparison.label2}</span>
            <span className="text-white/70" style={{ fontFamily: 'Rubik, sans-serif' }}>{percentage2.toFixed(0)}%</span>
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
      {/* Glass morphism card matching sidebar aesthetic */}
      <div className={`relative rounded-2xl bg-gradient-to-br ${currentTheme.gradients.sidebar} backdrop-blur-md shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-white/10 group-hover:shadow-[0_25px_70px_rgb(0,0,0,0.2)] transition-all duration-300 overflow-hidden`}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
          <div className="absolute top-4 right-4">
            <Icon className="w-16 h-16 text-white/20" />
          </div>
        </div>
        
        {/* Glass reflection effect */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
        
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-white/20 via-white/40 to-white/20"></div>
        
        <div className="relative p-4 z-10">
          {/* Header with icon and title side by side */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/15 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {title}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {trend && (
                <div className="text-xs text-white/80 font-medium">
                  <span className="opacity-60">{trend.isPositive ? '↗' : '↘'}</span>
                  <span className="ml-1">{trend.value}</span>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
            </div>
          </div>
          
          {/* Main content */}
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-sm text-white/80 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>{subtitle}</p>
            </div>

            {/* Compact stats grid with glass morphism */}
            <div className="grid grid-cols-2 gap-2">
              {stats.slice(0, 4).map((stat, index) => (
                <div 
                  key={index} 
                  className="text-center rounded-lg py-2 px-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-all duration-200"
                >
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-white/70 font-medium leading-tight" style={{ fontFamily: 'Rubik, sans-serif' }}>{stat.label}</p>
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