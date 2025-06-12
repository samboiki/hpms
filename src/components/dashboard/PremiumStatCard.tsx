import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

  // Get card-specific colors and settings
  const getCardSettings = () => {
    switch (cardType) {
      case 'patients':
        return {
          primaryColor: '#3B82F6',
          secondaryColor: '#93C5FD',
          gradientFrom: 'from-blue-500',
          gradientTo: 'to-cyan-600',
          bgImage: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          comparisonData: [
            { label: 'Male', value: 120, color: '#3B82F6' },
            { label: 'Female', value: 130, color: '#93C5FD' }
          ],
          donutData: [
            { label: 'New', value: 15, color: '#10B981' },
            { label: 'Active', value: 235, color: '#3B82F6' }
          ]
        };
      case 'communication':
        return {
          primaryColor: '#F59E0B',
          secondaryColor: '#FCD34D',
          gradientFrom: 'from-amber-500',
          gradientTo: 'to-orange-600',
          bgImage: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          comparisonData: [
            { label: 'Read', value: 23, color: '#F59E0B' },
            { label: 'Unread', value: 5, color: '#FCD34D' }
          ],
          donutData: [
            { label: 'Urgent', value: 2, color: '#EF4444' },
            { label: 'Normal', value: 26, color: '#F59E0B' }
          ]
        };
      case 'encounters':
        return {
          primaryColor: '#ff4f5a',
          secondaryColor: '#ff8a92',
          gradientFrom: 'from-red-500',
          gradientTo: 'to-pink-500',
          bgImage: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          comparisonData: [
            { label: 'Completed', value: 142, color: '#ff4f5a' },
            { label: 'Pending', value: 14, color: '#ff8a92' }
          ],
          donutData: [
            { label: 'This Month', value: 23, color: '#10B981' },
            { label: 'Previous', value: 133, color: '#ff4f5a' }
          ]
        };
      case 'finance':
        return {
          primaryColor: '#01b9d5',
          secondaryColor: '#67e8f9',
          gradientFrom: 'from-cyan-500',
          gradientTo: 'to-blue-500',
          bgImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          comparisonData: [
            { label: 'Paid', value: 119800, color: '#01b9d5' },
            { label: 'Outstanding', value: 5200, color: '#67e8f9' }
          ],
          donutData: [
            { label: 'This Month', value: 18500, color: '#10B981' },
            { label: 'Previous', value: 106500, color: '#01b9d5' }
          ]
        };
      default:
        return {
          primaryColor: '#6B7280',
          secondaryColor: '#9CA3AF',
          gradientFrom: 'from-gray-400',
          gradientTo: 'to-gray-500',
          bgImage: '',
          bgOpacity: 'opacity-10',
          comparisonData: [],
          donutData: []
        };
    }
  };

  const settings = getCardSettings();

  // Render horizontal stacked bar comparison
  const renderComparisonBar = () => {
    if (!settings.comparisonData || settings.comparisonData.length !== 2) return null;

    const [item1, item2] = settings.comparisonData;
    const total = item1.value + item2.value;
    const percentage1 = total > 0 ? (item1.value / total) * 100 : 0;
    const percentage2 = total > 0 ? (item2.value / total) * 100 : 0;

    return (
      <div className="mt-3">
        {/* Horizontal Stacked Bar */}
        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage1}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full rounded-l-full"
            style={{ backgroundColor: item1.color }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage2}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-0 h-full rounded-r-full"
            style={{ backgroundColor: item2.color }}
          />
        </div>
        
        {/* Compact Labels */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: item1.color }}
            />
            <span className="font-medium text-gray-700">{item1.label}</span>
            <span className="text-gray-500">{percentage1.toFixed(0)}%</span>
          </div>
          
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: item2.color }}
            />
            <span className="font-medium text-gray-700">{item2.label}</span>
            <span className="text-gray-500">{percentage2.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    );
  };

  // Render mini donut chart or mini stat cards for patients
  const renderMiniStats = () => {
    if (cardType === 'patients') {
      // Mini stat cards with engraved effect for patients
      return (
        <div className="flex gap-2 mt-3">
          <div className="flex-1 relative">
            {/* Engraved/Inset Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg opacity-20"></div>
            <div className="relative bg-gradient-to-br from-gray-100 to-white rounded-lg p-2 shadow-inner border border-gray-200/50">
              {/* Inner shadow for engraved effect */}
              <div className="absolute inset-0 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]"></div>
              <div className="relative text-center">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></div>
                </div>
                <p className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>15</p>
                <p className="text-[10px] text-gray-600 font-medium leading-tight">New</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative">
            {/* Engraved/Inset Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg opacity-20"></div>
            <div className="relative bg-gradient-to-br from-gray-100 to-white rounded-lg p-2 shadow-inner border border-gray-200/50">
              {/* Inner shadow for engraved effect */}
              <div className="absolute inset-0 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]"></div>
              <div className="relative text-center">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></div>
                </div>
                <p className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>42y</p>
                <p className="text-[10px] text-gray-600 font-medium leading-tight">Avg Age</p>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // Mini donut chart for other cards
      if (!settings.donutData || settings.donutData.length === 0) return null;

      return (
        <div className="flex items-center justify-center mt-2">
          <div className="w-12 h-12 opacity-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={settings.donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={12}
                  outerRadius={20}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {settings.donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
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
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {mainValue}
              </p>
              <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
            </div>

            {/* Horizontal Comparison Bar */}
            {renderComparisonBar()}

            {/* Mini Stats or Donut Chart */}
            {renderMiniStats()}
          </div>
        </div>

        {/* Bottom Gradient Bar */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} opacity-40 group-hover:opacity-60 transition-opacity duration-300`}></div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;