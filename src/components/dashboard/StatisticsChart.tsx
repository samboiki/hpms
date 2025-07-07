import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import { ChevronDown, Filter, TrendingUp, TrendingDown, Calendar, Users } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface StatChartProps {
  title: string;
  data: any[];
  chartType: 'bar' | 'line' | 'pie' | 'area';
  primaryColor?: string;
  secondaryColor?: string;
  filters?: {
    timeRange: FilterOption[];
    category: FilterOption[];
    demographic?: FilterOption[];
  };
  onFilterChange?: (filterType: string, value: string) => void;
  loading?: boolean;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    period: string;
  };
}

const COLORS = ['#01b9d4', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'];

const StatisticsChart: React.FC<StatChartProps> = ({
  title,
  data,
  chartType,
  primaryColor = '#01b9d4',
  secondaryColor = '#0891b2',
  filters,
  onFilterChange,
  loading = false,
  trend
}) => {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({
    timeRange: 'thisMonth',
    category: 'all',
    demographic: 'all'
  });
  
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (filterType: string, value: string) => {
    setSelectedFilters(prev => ({ ...prev, [filterType]: value }));
    onFilterChange?.(filterType, value);
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
        </div>
      );
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={primaryColor} 
                strokeWidth={3}
                dot={{ fill: primaryColor, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={primaryColor} 
                fill={`${primaryColor}20`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill={primaryColor}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {trend && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                trend.direction === 'up' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.value > 0 ? '+' : ''}{trend.value}% {trend.period}
              </div>
            )}
            {filters && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Filter className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && filters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-4 bg-gray-50 rounded-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filters.timeRange && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time Range</label>
                  <select
                    value={selectedFilters.timeRange}
                    onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    {filters.timeRange.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {filters.category && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={selectedFilters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    {filters.category.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {filters.demographic && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Demographic</label>
                  <select
                    value={selectedFilters.demographic}
                    onChange={(e) => handleFilterChange('demographic', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    {filters.demographic.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Chart */}
      <div className="p-6">
        {renderChart()}
      </div>
    </motion.div>
  );
};

export default StatisticsChart;