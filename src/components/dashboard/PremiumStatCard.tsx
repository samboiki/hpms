import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ChevronRight } from 'lucide-react';

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
  const renderComparisonChart = () => {
    if (!comparison) return null;

    const total = comparison.value1 + comparison.value2;
    const percentage1 = total > 0 ? (comparison.value1 / total) * 100 : 0;
    const percentage2 = total > 0 ? (comparison.value2 / total) * 100 : 0;

    return (
      <div className="mt-3">
        {/* Compact Horizontal Stacked Bar */}
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage1}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full"
            style={{ backgroundColor: comparison.color1 }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage2}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-0 h-full"
            style={{ backgroundColor: comparison.color2 }}
          />
        </div>
        
        {/* Compact Labels in Single Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: comparison.color1 }}
            />
            <span className="font-medium text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>{comparison.label1}</span>
            <span className="text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>{percentage1.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: comparison.color2 }}
            />
            <span className="font-medium text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>{comparison.label2}</span>
            <span className="text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>{percentage2.toFixed(0)}%</span>
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
      {/* Completely transparent card */}
      <div className="relative rounded-2xl transition-all duration-300 overflow-hidden">
        <div className="relative rounded-2xl h-full w-full overflow-hidden">
        
        <div className="relative p-4 z-10">
          {/* Header with icon and title side by side */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-gradient-to-br ${gradient} rounded-xl shadow-md`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {title}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {trend && (
                <div className="text-xs text-gray-600 font-medium">
                  <span className="opacity-60">{trend.isPositive ? '↗' : '↘'}</span>
                  <span className="ml-1">{trend.value}</span>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
          </div>
          
          {/* Main content */}
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-sm text-gray-600 font-normal" style={{ fontFamily: 'Montserrat, sans-serif' }}>{subtitle}</p>
            </div>

            {/* Compact comparison chart */}
            {renderComparisonChart()}
          </div>
        </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;