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
        {/* Premium Horizontal Stacked Bar */}
        <div className="relative h-2.5 bg-white/40 backdrop-blur-sm rounded-full overflow-hidden mb-2 shadow-inner border border-white/30">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage1}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full shadow-sm"
            style={{ backgroundColor: comparison.color1 }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage2}%` }}
            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
            className="absolute right-0 top-0 h-full shadow-sm"
            style={{ backgroundColor: comparison.color2 }}
          />
        </div>
        
        {/* Premium Labels */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 bg-white/30 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/40">
            <div 
              className="w-2 h-2 rounded-full shadow-sm" 
              style={{ backgroundColor: comparison.color1 }}
            />
            <span className="font-medium text-gray-800" style={{ fontFamily: 'Montserrat, sans-serif' }}>{comparison.label1}</span>
            <span className="text-gray-700 font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>{percentage1.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center gap-1 bg-white/30 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/40">
            <div 
              className="w-2 h-2 rounded-full shadow-sm" 
              style={{ backgroundColor: comparison.color2 }}
            />
            <span className="font-medium text-gray-800" style={{ fontFamily: 'Montserrat, sans-serif' }}>{comparison.label2}</span>
            <span className="text-gray-700 font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>{percentage2.toFixed(0)}%</span>
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
      {/* Premium card with Unsplash background */}
      <div className="relative rounded-2xl shadow-xl group-hover:shadow-2xl transition-all duration-500 overflow-hidden border border-white/20">
        <div className="relative rounded-2xl h-full w-full overflow-hidden">
        {/* Static white medical background images */}
        <div className="absolute inset-0">
          <img
            src={(() => {
              const imageMap: { [key: string]: string } = {
                'patients': 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&h=600&fit=crop&auto=format&q=90',
                'communication': 'https://images.unsplash.com/photo-1612277795421-9bc7706a4a34?w=800&h=600&fit=crop&auto=format&q=90',
                'encounters': 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&h=600&fit=crop&auto=format&q=90',
                'finance': 'https://images.unsplash.com/photo-1666214280391-8ff5929d87fd?w=800&h=600&fit=crop&auto=format&q=90'
              };
              return imageMap[title.toLowerCase()] || 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&h=600&fit=crop&auto=format&q=90';
            })()}
            alt="Medical background"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to a clean white medical image
              e.currentTarget.src = 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&h=600&fit=crop&auto=format&q=90';
            }}
          />
        </div>
        
        {/* Much more transparent overlay to show images clearly */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/30 to-white/35"></div>
        
        {/* Very subtle glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/15 via-transparent to-white/10"></div>
        
        {/* Minimal color accent */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-3 group-hover:opacity-5 transition-opacity duration-300`}></div>
        
        <div className="relative p-4 z-10">
          {/* Header with icon and title side by side */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-3 bg-gradient-to-br ${gradient} rounded-xl shadow-lg backdrop-blur-sm border border-white/30`}>
                <Icon className="w-5 h-5 text-white drop-shadow-sm" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 drop-shadow-md" style={{ fontFamily: 'Rubik, sans-serif' }}>
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
              <p className="text-3xl font-bold text-gray-900 mb-1 drop-shadow-md" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-sm text-gray-800 font-normal drop-shadow-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>{subtitle}</p>
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