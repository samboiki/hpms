import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

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
  cardType?: 'patients' | 'communication' | 'encounters' | 'finance';
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
  unsplashQuery,
  cardType = 'patients'
}) => {

  // Generate mock chart data based on card type
  const generateChartData = () => {
    switch (cardType) {
      case 'patients':
        return [
          { name: '6mo ago', value: 210 },
          { name: '5mo ago', value: 225 },
          { name: '4mo ago', value: 215 },
          { name: '3mo ago', value: 240 },
          { name: '2mo ago', value: 235 },
          { name: 'Last month', value: 250 }
        ];
      case 'communication':
        return [
          { name: 'Mon', value: 12 },
          { name: 'Tue', value: 18 },
          { name: 'Wed', value: 15 },
          { name: 'Thu', value: 25 },
          { name: 'Fri', value: 20 },
          { name: 'Sat', value: 28 },
          { name: 'Sun', value: 22 }
        ];
      case 'encounters':
        return [
          { name: '6mo', value: 135 },
          { name: '5mo', value: 128 },
          { name: '4mo', value: 142 },
          { name: '3mo', value: 145 },
          { name: '2mo', value: 138 },
          { name: '1mo', value: 156 }
        ];
      case 'finance':
        return [
          { name: '6mo', value: 95000 },
          { name: '5mo', value: 105000 },
          { name: '4mo', value: 88000 },
          { name: '3mo', value: 125000 },
          { name: '2mo', value: 115000 },
          { name: '1mo', value: 125000 }
        ];
      default:
        return [];
    }
  };

  const chartData = generateChartData();

  // Get card-specific colors and settings
  const getCardSettings = () => {
    switch (cardType) {
      case 'patients':
        return {
          primaryColor: '#3B82F6',
          secondaryColor: '#06B6D4',
          gradientFrom: 'from-blue-500',
          gradientTo: 'to-cyan-600',
          bgImage: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          gridStats: [
            { label: 'Male', value: '120', color: '#3B82F6' },
            { label: 'Female', value: '130', color: '#06B6D4' },
            { label: 'New This Month', value: '15', color: '#10B981' },
            { label: 'Avg Age', value: '42y', color: '#8B5CF6' }
          ]
        };
      case 'communication':
        return {
          primaryColor: '#F59E0B',
          secondaryColor: '#EF4444',
          gradientFrom: 'from-amber-500',
          gradientTo: 'to-orange-600',
          bgImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          gridStats: [
            { label: 'Unread', value: '5', color: '#F59E0B' },
            { label: 'Urgent', value: '2', color: '#EF4444' },
            { label: 'Today', value: '8', color: '#10B981' },
            { label: 'Types', value: '4', color: '#8B5CF6' }
          ]
        };
      case 'encounters':
        return {
          primaryColor: '#10B981',
          secondaryColor: '#059669',
          gradientFrom: 'from-emerald-500',
          gradientTo: 'to-green-600',
          bgImage: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          gridStats: [
            { label: 'This Month', value: '23', color: '#10B981' },
            { label: 'Completed', value: '142', color: '#059669' },
            { label: 'Pending', value: '14', color: '#F59E0B' },
            { label: 'Types', value: '3', color: '#8B5CF6' }
          ]
        };
      case 'finance':
        return {
          primaryColor: '#8B5CF6',
          secondaryColor: '#7C3AED',
          gradientFrom: 'from-purple-500',
          gradientTo: 'to-indigo-600',
          bgImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          gridStats: [
            { label: 'This Month', value: 'N$18,500', color: '#8B5CF6' },
            { label: 'Outstanding', value: 'N$5,200', color: '#EF4444' },
            { label: 'Paid', value: '45', color: '#10B981' },
            { label: 'Unpaid', value: '8', color: '#F59E0B' }
          ]
        };
      default:
        return {
          primaryColor: '#6B7280',
          secondaryColor: '#4B5563',
          gradientFrom: 'from-gray-400',
          gradientTo: 'to-gray-500',
          bgImage: '',
          bgOpacity: 'opacity-10',
          gridStats: []
        };
    }
  };

  const settings = getCardSettings();

  const renderChart = () => {
    if (cardType === 'communication') {
      // Bar chart for communication
      const maxValue = Math.max(...chartData.map(d => d.value));
      return (
        <div className="relative">
          <div className="relative p-4 bg-gradient-to-br from-white/90 to-gray-50/80 rounded-xl border border-gray-200/60 backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-700">Trend Analysis</h4>
              <div className="text-xs text-gray-500">Last 7 periods</div>
            </div>
            <div className="relative">
              <div className="flex items-end justify-between h-16 gap-2 mb-3 px-1">
                {chartData.map((data, index) => (
                  <div 
                    key={index}
                    className="relative flex-1 flex flex-col justify-end group cursor-pointer"
                    style={{ 
                      minHeight: '3px', 
                      height: `${(data.value / maxValue) * 100}%`,
                      opacity: 1 
                    }}
                  >
                    <div 
                      className="relative rounded-t-lg overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                      style={{ 
                        height: '100%', 
                        background: `linear-gradient(to top, ${settings.primaryColor}, ${settings.secondaryColor})`,
                        boxShadow: `rgba(${settings.primaryColor}, 0.19) 0px 2px 4px`,
                        opacity: 1 
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                      {index === chartData.length - 1 && (
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                          <div className="w-1 h-1 bg-yellow-400 rounded-full shadow-sm"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-1">
                {chartData.map((data, index) => (
                  <div key={index} className="flex-1 text-center">
                    <span className="text-[10px] font-medium transition-colors text-gray-500">
                      {data.name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-4 top-0 bottom-6 pointer-events-none">
                <div className="absolute left-0 right-0 border-t border-gray-200/40" style={{ bottom: '25%' }}></div>
                <div className="absolute left-0 right-0 border-t border-gray-200/40" style={{ bottom: '50%' }}></div>
                <div className="absolute left-0 right-0 border-t border-gray-200/40" style={{ bottom: '75%' }}></div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // Line chart for other types
      return (
        <div className="relative p-4 bg-gradient-to-br from-white/90 to-gray-50/80 rounded-xl border border-gray-200/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-700">Performance Trend</h4>
            <div className="text-xs text-gray-500">Last 6 periods</div>
          </div>
          <div className="relative h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={settings.primaryColor} 
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{ 
                    fill: settings.primaryColor, 
                    stroke: 'white', 
                    strokeWidth: 2, 
                    r: 3,
                    className: 'drop-shadow-sm'
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-2 px-1">
            {chartData.map((data, index) => (
              <div key={index} className="text-xs text-gray-400 font-medium">
                {data.name}
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="relative group cursor-pointer"
      tabIndex={0}
      onClick={onClick}
    >
      <div className="relative bg-gray-100 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200/50">
        {/* Background Image */}
        <div className={`absolute inset-0 ${settings.bgOpacity} transition-opacity duration-300`}>
          <img 
            src={settings.bgImage} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Large Background Icon */}
        <div className="absolute top-2 right-2 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
          <Icon className="w-20 h-20 text-gray-400" />
        </div>
        
        {/* Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${settings.gradientFrom} ${settings.gradientTo} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
        
        <div className="relative p-4 z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-gradient-to-br ${settings.gradientFrom} ${settings.gradientTo} rounded-xl shadow-md`}>
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
          
          {/* Main Content */}
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-2">
              {settings.gridStats.map((stat, index) => (
                <div 
                  key={index}
                  className="text-center rounded-lg py-2 px-2 border border-gray-200/50 bg-white/60 backdrop-blur-sm"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <p className="text-sm font-bold text-gray-800" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-gray-600 font-medium leading-tight">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="mt-4 relative">
              {renderChart()}
            </div>
          </div>
        </div>

        {/* Bottom Gradient Bar */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} opacity-40 group-hover:opacity-60 transition-opacity duration-300`}></div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;