import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTheme } from '../../stores/themeStore';
import { 
  X, 
  Users, 
  Bell, 
  Activity, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  PieChart,
  Filter,
  Download,
  Printer,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }[];
}

interface ReportData {
  type: 'patients' | 'notifications' | 'encounters' | 'finance';
  title: string;
  subtitle: string;
  overview: {
    total: number;
    change: string;
    isPositive: boolean;
    period: string;
  };
  breakdown: {
    label: string;
    value: number;
    percentage: number;
    color: string;
  }[];
  chartData: ChartData;
  timeSeriesData?: ChartData;
  insights: string[];
  actionItems?: string[];
}

interface DetailedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReportData;
}

const DetailedReportModal: React.FC<DetailedReportModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'insights'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '3m' | '6m'>('30d');
  const [isMaximized, setIsMaximized] = useState(false);

  if (!isOpen) return null;

  const iconMap = {
    patients: Users,
    notifications: Bell,
    encounters: Activity,
    finance: DollarSign
  };

  const Icon = iconMap[data.type];

  const colorMap = {
    patients: 'from-blue-500 to-cyan-600',
    notifications: 'from-amber-500 to-orange-600',
    encounters: 'from-emerald-500 to-green-600',
    finance: 'from-purple-500 to-indigo-600'
  };

  const renderChart = () => {
    const maxValue = Math.max(...data.chartData.datasets[0].data);
    
    return (
      <div className="space-y-6">
        {/* Bar chart */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Distribution Overview
          </h4>
          <div className="space-y-3">
            {data.chartData.labels.map((label, index) => {
              const value = data.chartData.datasets[0].data[index];
              const percentage = (value / maxValue) * 100;
              
              return (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="font-bold text-gray-900">{value}</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                      className={`h-2 rounded-full bg-gradient-to-r ${colorMap[data.type]}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pie chart representation */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Breakdown Analysis
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {data.breakdown.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-lg font-bold text-gray-900">{item.value}</p>
                    <p className="text-xs text-gray-500">{item.percentage}%</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Time series if available */}
        {data.timeSeriesData && (
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Trend Analysis (Last {dateRange})
            </h4>
            <div className="flex items-end justify-between h-32 bg-white rounded-lg p-4">
              {data.timeSeriesData.datasets[0].data.map((value, index) => {
                const height = (value / Math.max(...data.timeSeriesData!.datasets[0].data)) * 100;
                return (
                  <div key={index} className="flex flex-col items-center gap-2">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                      className={`bg-gradient-to-t ${colorMap[data.type]} rounded-t-sm w-8`}
                    />
                    <span className="text-xs text-gray-500 rotate-45 origin-left">
                      {data.timeSeriesData!.labels[index]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] ${
        isMaximized ? 'p-0' : 'p-4'
      }`} 
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative bg-white shadow-2xl overflow-hidden w-full overflow-y-auto ${
          isMaximized ? 'rounded-none h-full' : 'rounded-2xl max-w-6xl max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${currentTheme.gradients.sidebar} p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{data.title}</h2>
                <p className="text-white/90">{data.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Overview stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Total</p>
              <p className="text-2xl font-bold">{data.overview.total}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Change</p>
              <div className="flex items-center gap-2">
                {data.overview.isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <p className="text-xl font-bold">{data.overview.change}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Period</p>
              <p className="text-lg font-semibold">{data.overview.period}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Date Range</p>
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="7d" className="text-gray-900">Last 7 days</option>
                <option value="30d" className="text-gray-900">Last 30 days</option>
                <option value="3m" className="text-gray-900">Last 3 months</option>
                <option value="6m" className="text-gray-900">Last 6 months</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'charts', label: 'Charts & Analysis', icon: PieChart },
              { id: 'insights', label: 'Insights', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? `border-current text-gray-900 bg-gray-50`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Key Metrics</h3>
                    {data.breakdown.map((item, index) => (
                      <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-gray-700">{item.label}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{item.value}</p>
                          <p className="text-sm text-gray-500">{item.percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
                    {data.actionItems?.map((action, index) => (
                      <button
                        key={index}
                        className="w-full text-left p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                      >
                        <p className="font-medium text-blue-900">{action}</p>
                      </button>
                    )) || (
                      <p className="text-gray-500 italic">No quick actions available</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'charts' && renderChart()}

              {activeTab === 'insights' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Insights</h3>
                    <div className="space-y-3">
                      {data.insights.map((insight, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                          <p className="text-gray-700">{insight}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {data.actionItems && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Recommended Actions</h3>
                      <div className="space-y-3">
                        {data.actionItems.map((action, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + 0.3 }}
                            className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200"
                          >
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                            <p className="text-blue-900 font-medium">{action}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default DetailedReportModal;