import React from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Dot } from 'recharts';
import { motion } from 'framer-motion';

interface PremiumTrendChartProps {
  data: number[];
  title: string;
  gradient: string;
  className?: string;
}

const PremiumTrendChart: React.FC<PremiumTrendChartProps> = ({
  data,
  title,
  gradient,
  className = ""
}) => {
  // Convert data array to chart format
  const chartData = data.map((value, index) => ({
    period: index,
    value: value,
    label: title === 'Finance' || title === 'Encounters' 
      ? ['6mo', '5mo', '4mo', '3mo', '2mo', '1mo'][index] 
      : ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'][index]
  }));

  // Color mapping based on gradient
  const colorMap: Record<string, { primary: string; secondary: string; light: string }> = {
    'from-blue-500': { primary: '#3B82F6', secondary: '#60A5FA', light: '#EBF8FF' },
    'from-green-500': { primary: '#10B981', secondary: '#34D399', light: '#D1FAE5' },
    'from-purple-500': { primary: '#8B5CF6', secondary: '#A78BFA', light: '#EDE9FE' },
    'from-red-500': { primary: '#EF4444', secondary: '#F87171', light: '#FEE2E2' },
    'from-yellow-500': { primary: '#F59E0B', secondary: '#FBBF24', light: '#FEF3C7' },
    'from-indigo-500': { primary: '#6366F1', secondary: '#818CF8', light: '#E0E7FF' },
    'from-pink-500': { primary: '#EC4899', secondary: '#F472B6', light: '#FCE7F3' },
    'from-teal-500': { primary: '#14B8A6', secondary: '#5EEAD4', light: '#D1FAE5' }
  };

  const gradientKey = Object.keys(colorMap).find(key => gradient.includes(key.replace('from-', ''))) || 'from-blue-500';
  const colors = colorMap[gradientKey as keyof typeof colorMap];

  // Custom dot component
  const CustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    
    return (
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          duration: 0.4, 
          delay: 0.8 + index * 0.1,
          type: "spring",
          stiffness: 300
        }}
      >
        {/* Glow effect */}
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={colors.primary}
          fillOpacity={0.2}
          stroke="none"
        />
        {/* Main dot */}
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill={colors.primary}
          stroke="white"
          strokeWidth={2}
          className="drop-shadow-sm"
        />
        {/* Inner highlight */}
        <circle
          cx={cx}
          cy={cy}
          r={1.5}
          fill="white"
          fillOpacity={0.8}
        />
      </motion.g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const periodLabel = payload[0].payload.label;
      
      return (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-700/50"
        >
          <div className="font-medium text-gray-200">{periodLabel}</div>
          <div className="font-bold" style={{ color: colors.secondary }}>
            {title === 'Finance' ? `N$${value.toLocaleString()}` : 
             title === 'Encounters' ? `${value} visits` : value}
          </div>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <div className={`mt-4 relative ${className}`}>
      <div className="relative p-4 bg-gradient-to-br from-white/90 to-gray-50/80 rounded-xl border border-gray-200/60 backdrop-blur-sm shadow-sm">
        {/* Chart title */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-700">Performance Trend</h4>
          <div className="text-xs text-gray-500">Last {data.length} periods</div>
        </div>
        
        {/* Chart container */}
        <div className="relative h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`chartGradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              
              <XAxis 
                dataKey="period" 
                axisLine={false} 
                tickLine={false} 
                tick={false}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={false}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              
              <Tooltip 
                content={<CustomTooltip />}
                cursor={false}
                position={{ x: undefined, y: -10 }}
              />
              
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors.primary}
                strokeWidth={2.5}
                fill={`url(#chartGradient-${title})`}
                dot={<CustomDot />}
                activeDot={{ 
                  r: 4, 
                  fill: colors.primary,
                  stroke: 'white',
                  strokeWidth: 2,
                  className: 'drop-shadow-md'
                }}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Period labels */}
        <div className="flex justify-between mt-2 px-1">
          {chartData.map((item, index) => (
            <div key={index} className="text-xs text-gray-400 font-medium">
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PremiumTrendChart;