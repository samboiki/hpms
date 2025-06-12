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
            <span className="font-medium text-gray-700" style={{ fontFamily: 'Rubik, sans-serif' }}>{comparison.label1}</span>
            <span className="text-gray-500" style={{ fontFamily: 'Rubik, sans-serif' }}>{percentage1.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: comparison.color2 }}
            />
            <span className="font-medium text-gray-700" style={{ fontFamily: 'Rubik, sans-serif' }}>{comparison.label2}</span>
            <span className="text-gray-500" style={{ fontFamily: 'Rubik, sans-serif' }}>{percentage2.toFixed(0)}%</span>
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
      {/* Main card with light grey background and gradient border */}
      <div className="relative rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 overflow-hidden p-[1px] bg-gradient-to-br from-gray-300/40 via-gray-400/30 to-gray-300/40">
        <div className="relative rounded-2xl h-full w-full overflow-hidden" style={{ backgroundColor: '#edf1f4' }}>
        {/* Unsplash background image */}
        {unsplashQuery && (
          <div className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity duration-300">
            <img
              src={(() => {
                const imageMap: { [key: string]: string } = {
                  'medical-patients-healthcare': 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=300&fit=crop&auto=format&q=80',
                  'notification-bell-communication': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop&auto=format&q=80',
                  'medical-consultation-stethoscope': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop&auto=format&q=80',
                  'money-finance-calculator': 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop&auto=format&q=80'
                };
                return imageMap[unsplashQuery] || imageMap['medical-patients-healthcare'];
              })()}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        
        {/* Background icon pattern */}
        <div className="absolute top-2 right-2 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
          <Icon className="w-20 h-20 text-gray-400" />
        </div>
        
        {/* Subtle gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
        
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
              <p className="text-sm text-gray-600 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>{subtitle}</p>
            </div>

            {/* Compact stats grid with colored backgrounds */}
            <div className="grid grid-cols-2 gap-2">
              {stats.slice(0, 4).map((stat, index) => (
                <div 
                  key={index} 
                  className="text-center rounded-lg py-2 px-2 border border-gray-200/50 bg-white/60 backdrop-blur-sm"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <p className="text-sm font-bold text-gray-800" style={{ color: stat.color, fontFamily: 'Rubik, sans-serif' }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-gray-600 font-medium leading-tight" style={{ fontFamily: 'Rubik, sans-serif' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Compact comparison chart */}
            {renderComparisonChart()}
          </div>
          
          {/* Colored bottom accent */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-40 group-hover:opacity-60 transition-opacity duration-300`}></div>
        </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;