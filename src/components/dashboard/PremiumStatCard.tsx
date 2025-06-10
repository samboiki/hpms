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

    // Ensure we have valid data, use fallback if needed
    const chartData = miniChart.data && miniChart.data.length > 0 
      ? miniChart.data 
      : [1, 3, 2, 5, 4, 6]; // Fallback demo data

    const maxValue = Math.max(...chartData);
    const minValue = Math.min(...chartData);

    console.log('Chart data:', chartData, 'Max value:', maxValue);

    switch (miniChart.type) {
      case 'line':
        // Extract primary and secondary colors from gradient
        const lineColorMap = {
          'from-blue-500': { primary: '#3B82F6', secondary: '#60A5FA', light: '#DBEAFE' },
          'from-amber-500': { primary: '#F59E0B', secondary: '#FBBF24', light: '#FEF3C7' },
          'from-emerald-500': { primary: '#10B981', secondary: '#34D399', light: '#D1FAE5' },
          'from-purple-500': { primary: '#8B5CF6', secondary: '#A78BFA', light: '#EDE9FE' }
        };
        
        const lineGradientKey = Object.keys(lineColorMap).find(key => gradient.includes(key.replace('from-', ''))) || 'from-blue-500';
        const lineColors = lineColorMap[lineGradientKey as keyof typeof lineColorMap];
        
        // Create smooth curve path using bezier curves and get exact coordinates
        const createSmoothPath = (points: number[]) => {
          if (points.length < 2) return { path: '', coordinates: [] };
          
          const scaledPoints = points.map((value, index) => ({
            x: (index / (points.length - 1)) * 100,
            y: 28 - ((value - minValue) / (maxValue - minValue)) * 24
          }));
          
          let path = `M ${scaledPoints[0].x} ${scaledPoints[0].y}`;
          
          for (let i = 1; i < scaledPoints.length; i++) {
            const prev = scaledPoints[i - 1];
            const curr = scaledPoints[i];
            const next = scaledPoints[i + 1];
            
            if (i === 1) {
              // First curve
              const cp1x = prev.x + (curr.x - prev.x) * 0.4;
              const cp1y = prev.y;
              const cp2x = curr.x - (curr.x - prev.x) * 0.4;
              const cp2y = curr.y;
              path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
            } else if (i === scaledPoints.length - 1) {
              // Last curve
              const cp1x = prev.x + (curr.x - prev.x) * 0.4;
              const cp1y = prev.y;
              const cp2x = curr.x - (curr.x - prev.x) * 0.4;
              const cp2y = curr.y;
              path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
            } else {
              // Middle curves with smoother control points
              const prevPoint = scaledPoints[i - 2] || prev;
              const cp1x = prev.x + (curr.x - prevPoint.x) * 0.2;
              const cp1y = prev.y + (curr.y - prevPoint.y) * 0.2;
              const cp2x = curr.x - (next.x - prev.x) * 0.2;
              const cp2y = curr.y - (next.y - prev.y) * 0.2;
              path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
            }
          }
          
          return { path, coordinates: scaledPoints };
        };
        
        const lineData = createSmoothPath(chartData);
        const linePath = lineData.path;
        const lineCoordinates = lineData.coordinates;
        const areaPath = linePath + ` L 100 28 L 0 28 Z`;
        
        // Dynamic labels based on card type
        const getLineLabels = () => {
          if (title === 'Finance' || title === 'Encounters') return ['6mo', '5mo', '4mo', '3mo', '2mo', '1mo'];
          return ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'];
        };
        
        const lineLabels = getLineLabels();
        
        return (
          <div className="mt-4 relative">
            {/* Premium line chart container */}
            <div className="relative p-4 bg-gradient-to-br from-white/90 to-gray-50/80 rounded-xl border border-gray-200/60 backdrop-blur-sm shadow-sm">
              {/* Chart title */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-700">Performance Trend</h4>
                <div className="text-xs text-gray-500">Last {lineLabels.length} periods</div>
              </div>
              
              {/* Line chart area */}
              <div className="relative h-16">
                {/* SVG for smooth curved line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 32" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`lineGradient-${camelCaseTitle}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={lineColors.primary} stopOpacity="0.9" />
                      <stop offset="50%" stopColor={lineColors.secondary} stopOpacity="0.7" />
                      <stop offset="100%" stopColor={lineColors.primary} stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id={`areaGradient-${camelCaseTitle}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={lineColors.primary} stopOpacity="0.3" />
                      <stop offset="50%" stopColor={lineColors.secondary} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={lineColors.primary} stopOpacity="0.05" />
                    </linearGradient>
                    <filter id={`glow-${camelCaseTitle}`}>
                      <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                      <feMerge> 
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Area fill under curve */}
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    d={areaPath}
                    fill={`url(#areaGradient-${camelCaseTitle})`}
                  />
                  
                  {/* Main curved line */}
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                    d={linePath}
                    stroke={`url(#lineGradient-${camelCaseTitle})`}
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#glow-${camelCaseTitle})`}
                  />
                  
                  {/* Glow effect */}
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.4 }}
                    transition={{ duration: 1.5, ease: "easeInOut", delay: 0.4 }}
                    d={linePath}
                    stroke={lineColors.primary}
                    strokeWidth="4"
                    fill="none"
                    strokeOpacity="0.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="blur(2px)"
                  />
                </svg>
                
                {/* Data points positioned exactly on the line */}
                {chartData.map((value, index) => {
                  // Use exact coordinates from the curve calculation
                  const x = lineCoordinates[index]?.x || (index / (chartData.length - 1)) * 100;
                  const y = lineCoordinates[index]?.y || 28 - ((value - minValue) / (maxValue - minValue)) * 24;
                  const yPercent = (y / 32) * 100;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ 
                        duration: 0.4, 
                        delay: 0.8 + index * 0.1,
                        type: "spring",
                        stiffness: 300
                      }}
                      className="absolute group cursor-pointer"
                      style={{ 
                        left: `${x}%`, 
                        top: `${yPercent}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Premium tooltip */}
                      {hoveredIndex === index && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 z-30"
                        >
                          <div className="bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-700/50">
                            <div className="font-medium text-gray-200">{lineLabels[index]}</div>
                            <div className="font-bold" style={{ color: lineColors.secondary }}>
                              {title === 'Finance' ? `N$${value.toLocaleString()}` : 
                               title === 'Encounters' ? `${value} visits` : value}
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900"></div>
                        </motion.div>
                      )}
                      
                      {/* Premium dot on line */}
                      <div
                        className="w-3 h-3 rounded-full shadow-lg transition-all duration-300 group-hover:scale-150 group-hover:shadow-xl relative"
                        style={{ 
                          background: `radial-gradient(circle, ${lineColors.secondary}, ${lineColors.primary})`,
                          boxShadow: hoveredIndex === index 
                            ? `0 0 12px ${lineColors.primary}60, 0 0 0 2px white, 0 0 0 3px ${lineColors.primary}40`
                            : `0 2px 4px ${lineColors.primary}40, 0 0 0 2px white`
                        }}
                      >
                        {/* Inner glow */}
                        <div 
                          className="absolute inset-0.5 rounded-full"
                          style={{ background: `radial-gradient(circle, ${lineColors.secondary}80, transparent)` }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Premium labels */}
              <div className="flex items-center justify-between mt-3 px-1">
                {lineLabels.map((label, index) => (
                  <div key={index} className="flex-1 text-center">
                    <span className={`text-[10px] font-medium transition-colors ${
                      hoveredIndex === index ? 'text-gray-800' : 'text-gray-500'
                    }`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'bar':
        // Extract primary and secondary colors from gradient
        const colorMap = {
          'from-blue-500': { primary: '#3B82F6', secondary: '#60A5FA', light: '#DBEAFE' },
          'from-amber-500': { primary: '#F59E0B', secondary: '#FBBF24', light: '#FEF3C7' },
          'from-emerald-500': { primary: '#10B981', secondary: '#34D399', light: '#D1FAE5' },
          'from-purple-500': { primary: '#8B5CF6', secondary: '#A78BFA', light: '#EDE9FE' }
        };
        
        const gradientKey = Object.keys(colorMap).find(key => gradient.includes(key.replace('from-', ''))) || 'from-blue-500';
        const colors = colorMap[gradientKey as keyof typeof colorMap];
        
        // Dynamic labels based on card type
        const getLabels = () => {
          if (title === 'Communication') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          if (title === 'Finance' || title === 'Encounters') return ['6mo', '5mo', '4mo', '3mo', '2mo', '1mo'];
          return ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'];
        };
        
        const labels = getLabels();
        
        return (
          <div className="mt-4 relative">
            {/* Premium bar chart container */}
            <div className="relative p-4 bg-gradient-to-br from-white/90 to-gray-50/80 rounded-xl border border-gray-200/60 backdrop-blur-sm shadow-sm">
              {/* Chart title */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-700">Trend Analysis</h4>
                <div className="text-xs text-gray-500">Last {labels.length} periods</div>
              </div>
              
              {/* Bar chart area */}
              <div className="relative">
                <div className="flex items-end justify-between h-16 gap-2 mb-3 px-1">
                  {chartData.map((value, index) => {
                    // Calculate height as percentage of container - highest value gets 100% height
                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    const isHighest = value === maxValue;
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: `${height}%`, opacity: 1 }}
                        transition={{ 
                          duration: 0.6, 
                          delay: index * 0.1,
                          ease: [0.25, 0.46, 0.45, 0.94]
                        }}
                        className="relative flex-1 flex flex-col justify-end group cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{ minHeight: height > 0 ? '3px' : '0px' }}
                      >
                        {/* Premium tooltip */}
                        {hoveredIndex === index && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-30"
                          >
                            <div className="bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-700/50">
                              <div className="font-medium text-gray-200">{labels[index]}</div>
                              <div className="font-bold" style={{ color: colors.secondary }}>
                                {title === 'Finance' ? `N$${value.toLocaleString()}` : 
                                 title === 'Communication' ? `${value} messages` :
                                 title === 'Encounters' ? `${value} visits` : value}
                              </div>
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900"></div>
                          </motion.div>
                        )}
                        
                        {/* Premium bar with gradient and glow */}
                        <div
                          className="relative rounded-t-lg overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                          style={{ 
                            height: '100%',
                            background: `linear-gradient(to top, ${colors.primary}, ${colors.secondary})`,
                            boxShadow: hoveredIndex === index 
                              ? `0 4px 12px ${colors.primary}40, 0 0 0 1px ${colors.primary}20`
                              : `0 2px 4px ${colors.primary}30`,
                            opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.7
                          }}
                        >
                          {/* Shimmer effect */}
                          <div 
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700"
                          />
                          
                          {/* Highlight for highest value */}
                          {isHighest && (
                            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                              <div className="w-1 h-1 bg-yellow-400 rounded-full shadow-sm"></div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
                {/* Premium labels */}
                <div className="flex items-center justify-between px-1">
                  {labels.map((label, index) => (
                    <div key={index} className="flex-1 text-center">
                      <span className={`text-[10px] font-medium transition-colors ${
                        hoveredIndex === index ? 'text-gray-800' : 'text-gray-500'
                      }`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Subtle grid lines */}
                <div className="absolute inset-x-4 top-0 bottom-6 pointer-events-none">
                  {[25, 50, 75].map((percent) => (
                    <div 
                      key={percent}
                      className="absolute left-0 right-0 border-t border-gray-200/40"
                      style={{ bottom: `${percent}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'donut':
        const donutColor = gradient.includes('blue') ? '#3B82F6' : 
                          gradient.includes('amber') ? '#F59E0B' :
                          gradient.includes('emerald') ? '#10B981' : '#8B5CF6';
        const total = chartData.reduce((sum, value) => sum + value, 0);
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
                {chartData.map((value, index) => {
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
            {miniChart && renderMiniChart()}
          </div>
          
          {/* Colored bottom accent */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-40 group-hover:opacity-60 transition-opacity duration-300`}></div>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;