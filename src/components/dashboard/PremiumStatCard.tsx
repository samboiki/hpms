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
  unsplashQuery?: string;
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
  trend,
  unsplashQuery
}) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  
  // Convert title to camelCase
  const camelCaseTitle = title.replace(/\s+(.)/g, (match, letter) => letter.toUpperCase()).replace(/^\w/, c => c.toLowerCase());
  const renderMiniChart = () => {
    if (!miniChart) return null;

    const maxValue = Math.max(...miniChart.data);
    const minValue = Math.min(...miniChart.data);

    switch (miniChart.type) {
      case 'line':
        const lineColor = gradient.includes('blue') ? '#3B82F6' : 
                         gradient.includes('amber') ? '#F59E0B' :
                         gradient.includes('emerald') ? '#10B981' : '#8B5CF6';
        
        return (
          <div className="mt-2">
            <div className="flex items-end justify-between h-8 relative">
              {/* Smooth line path */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 32" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`lineGradient-${camelCaseTitle}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.8" />
                    <stop offset="50%" stopColor={lineColor} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id={`areaGradient-${camelCaseTitle}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                
                {/* Area fill */}
                <path
                  d={`M 0 32 ${miniChart.data.map((value, index) => {
                    const x = (index / (miniChart.data.length - 1)) * 100;
                    const y = 32 - ((value - minValue) / (maxValue - minValue)) * 24;
                    return `L ${x} ${y}`;
                  }).join(' ')} L 100 32 Z`}
                  fill={`url(#areaGradient-${camelCaseTitle})`}
                />
                
                {/* Line */}
                <path
                  d={`M ${miniChart.data.map((value, index) => {
                    const x = (index / (miniChart.data.length - 1)) * 100;
                    const y = 32 - ((value - minValue) / (maxValue - minValue)) * 24;
                    return index === 0 ? `${x} ${y}` : `L ${x} ${y}`;
                  }).join(' ')}`}
                  stroke={`url(#lineGradient-${camelCaseTitle})`}
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
                  stroke={lineColor}
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
                const monthLabels = ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'];
                return (
                  <div
                    key={index}
                    className="relative flex-1 flex justify-center group"
                    style={{ height: '32px' }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Tooltip */}
                    {hoveredIndex === index && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          <div className="font-medium">{monthLabels[index]}</div>
                          <div>{value} {title === 'Patients' ? 'new patients' : 'visits'}</div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                    
                    <div
                      className="absolute bottom-0 w-2 h-2 rounded-full shadow-lg opacity-80 cursor-pointer transition-all duration-200 hover:w-3 hover:h-3"
                      style={{ bottom: `${height}%`, backgroundColor: lineColor }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      
      case 'bar':
        const barColor = gradient.includes('blue') ? '#3B82F6' : 
                        gradient.includes('amber') ? '#F59E0B' :
                        gradient.includes('emerald') ? '#10B981' : 
                        gradient.includes('purple') ? '#8B5CF6' : '#3B82F6';
        
        // Dynamic labels based on card type
        const getLabels = () => {
          if (title === 'Communication') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          if (title === 'Finance' || title === 'Encounters') return ['6mo', '5mo', '4mo', '3mo', '2mo', '1mo'];
          return ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'];
        };
        
        const labels = getLabels();
        
        return (
          <div className="mt-3 relative">
            {/* Enhanced bar chart container */}
            <div className="relative p-3 bg-white/40 rounded-lg border border-gray-200/30 backdrop-blur-sm">
              <div className="flex items-end justify-between h-16 gap-1 mb-4">
                {miniChart.data.map((value, index) => {
                  // Calculate height as percentage of container, but ensure minimum visibility
                  const heightPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  const height = Math.max(heightPercentage, value > 0 ? 15 : 0); // 15% minimum for visible bars, 0% for zero values
                  return (
                    <div
                      key={index}
                      className="relative flex-1 flex flex-col justify-end group"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Enhanced tooltip */}
                      {hoveredIndex === index && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 z-20">
                          <div className="bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl border border-gray-700">
                            <div className="font-semibold text-gray-100">{labels[index]}</div>
                            <div className="font-bold" style={{ color: barColor }}>
                              {title === 'Finance' ? `N$${value.toLocaleString()}` : 
                               title === 'Communication' ? `${value} messages` :
                               title === 'Encounters' ? `${value} visits` : value}
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                      
                      {/* Enhanced glow effect */}
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-md opacity-20 blur-sm"
                        style={{ 
                          height: `${height}%`, 
                          backgroundColor: barColor 
                        }}
                      />
                      
                      {/* Enhanced main bar with proportional height */}
                      <div
                        className="rounded-t-md relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg w-full"
                        style={{ 
                          height: `${height}%`,
                          backgroundColor: barColor,
                          background: `linear-gradient(to top, ${barColor}, ${barColor}CC, ${barColor}99)`,
                          boxShadow: `0 2px 4px ${barColor}40`
                        }}
                      >
                        {/* Enhanced shimmer effect */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform skew-x-12 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Bar labels with better positioning */}
              <div className="flex items-center justify-between -mt-2">
                {labels.map((label, index) => (
                  <div key={index} className="flex-1 text-center">
                    <span className="text-[10px] font-medium text-gray-600 block truncate px-0.5">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Chart baseline */}
              <div className="absolute bottom-8 left-3 right-3 h-px bg-gray-300/50"></div>
            </div>
          </div>
        );
      
      case 'donut':
        const donutColor = gradient.includes('blue') ? '#3B82F6' : 
                          gradient.includes('amber') ? '#F59E0B' :
                          gradient.includes('emerald') ? '#10B981' : '#8B5CF6';
        const total = miniChart.data.reduce((sum, value) => sum + value, 0);
        let cumulativeAngle = 0;
        
        return (
          <div className="mt-2 flex justify-center">
            <div className="relative w-12 h-12">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
                <defs>
                  <filter id={`glow-${camelCaseTitle}`}>
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
                  stroke={donutColor}
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
                      stroke={donutColor}
                      strokeOpacity={0.9 - index * 0.15}
                      strokeWidth="2"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      filter={`url(#glow-${camelCaseTitle})`}
                    />
                  );
                })}
              </svg>
              
              {/* Center value */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold" style={{ color: donutColor }}>{total}</span>
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
      {/* Main card with light grey background */}
      <div className="relative bg-gray-100 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200/50">
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
                <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
              <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
            </div>

            {/* Compact stats grid with colored backgrounds */}
            <div className="grid grid-cols-2 gap-2">
              {stats.slice(0, 4).map((stat, index) => (
                <div 
                  key={index} 
                  className="text-center rounded-lg py-2 px-2 border border-gray-200/50 bg-white/60 backdrop-blur-sm"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <p className="text-sm font-bold text-gray-800" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-gray-600 font-medium leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Enhanced mini chart with colored theme */}
            {miniChart && (
              <div className="mt-4">
                <div className="p-3 bg-white/50 rounded-lg border border-gray-200/30">
                  {renderMiniChart()}
                </div>
              </div>
            )}
          </div>
          
          {/* Colored bottom accent */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-40 group-hover:opacity-60 transition-opacity duration-300`}></div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;