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
  dashboardStats?: any;
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
  cardType = 'patients',
  dashboardStats
}) => {

  // Get card-specific colors and settings
  const getCardSettings = () => {
    switch (cardType) {
      case 'patients':
        return {
          primaryColor: '#489bfd',
          secondaryColor: '#7db3fe',
          gradientFrom: 'from-[#489bfd]',
          gradientTo: 'to-[#7db3fe]',
          bgImage: 'https://plus.unsplash.com/premium_photo-1731410157801-dbea9a996cde?w=400&h=300&fit=crop&auto=format&q=80',
          bgOpacity: 'opacity-10 group-hover:opacity-15',
          comparisonData: [
            { label: 'Male', value: 120, color: '#489bfd' },
            { label: 'Female', value: 130, color: '#7db3fe' }
          ],
          donutData: [
            { label: 'New', value: 15, color: '#10B981' },
            { label: 'Active', value: 235, color: '#489bfd' }
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
          bgImage: '/images/medical-aids/enc.png',
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
          bgImage: 'https://plus.unsplash.com/premium_photo-1679922389798-8b38c78b5670?w=400&h=300&fit=crop&auto=format&q=80',
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

  // Render legend without bar chart
  const renderLegendOnly = () => {
    // Use comparison prop if provided, otherwise fall back to settings
    const comparisonData = comparison ? [
      { label: comparison.label1, value: comparison.value1, color: comparison.color1 },
      { label: comparison.label2, value: comparison.value2, color: comparison.color2 }
    ] : settings.comparisonData;

    if (!comparisonData || comparisonData.length !== 2) return null;

    const [item1, item2] = comparisonData;
    const total = item1.value + item2.value;
    
    // For communication card with zero values, show 0% for both
    let percentage1, percentage2;
    if (cardType === 'communication' && total === 0) {
      percentage1 = 0;
      percentage2 = 0;
    } else {
      percentage1 = total > 0 ? (item1.value / total) * 100 : 0;
      percentage2 = total > 0 ? (item2.value / total) * 100 : 0;
    }

    return (
      <div className="mt-3">
        {/* Premium Legend with enhanced styling */}
        <div className="space-y-2">
          {/* SMS Legend Item */}
          <div className="flex items-center justify-between text-xs group">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div 
                  className="w-3 h-3 rounded-full shadow-sm transition-all duration-300 group-hover:scale-110" 
                  style={{ 
                    backgroundColor: item1.color,
                    boxShadow: `0 0 8px ${item1.color}20`
                  }}
                />
                {/* Pulse effect for 0% */}
                {percentage1 === 0 && (
                  <div 
                    className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-30"
                    style={{ backgroundColor: item1.color }}
                  />
                )}
              </div>
              <span className="font-semibold text-gray-800 tracking-wide">{item1.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span 
                className="font-bold text-xs px-2 py-1 rounded-full"
                style={{ 
                  backgroundColor: `${item1.color}15`,
                  color: item1.color
                }}
              >
                {percentage1.toFixed(0)}%
              </span>
            </div>
          </div>
          
          {/* Email Legend Item */}
          <div className="flex items-center justify-between text-xs group">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div 
                  className="w-3 h-3 rounded-full shadow-sm transition-all duration-300 group-hover:scale-110" 
                  style={{ 
                    backgroundColor: item2.color,
                    boxShadow: `0 0 8px ${item2.color}20`
                  }}
                />
                {/* Pulse effect for 0% */}
                {percentage2 === 0 && (
                  <div 
                    className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-30"
                    style={{ backgroundColor: item2.color }}
                  />
                )}
              </div>
              <span className="font-semibold text-gray-800 tracking-wide">{item2.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span 
                className="font-bold text-xs px-2 py-1 rounded-full"
                style={{ 
                  backgroundColor: `${item2.color}15`,
                  color: item2.color
                }}
              >
                {percentage2.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render mini donut chart or mini stat cards for patients
  const renderMiniStats = () => {
    if (cardType === 'patients') {
      // No mini stats for patients card
      return null;
    } else if (cardType === 'communication' || cardType === 'encounters' || cardType === 'finance') {
      // No mini stats for communication, encounters, and finance cards
      return null;
    } else {
      // Mini donut chart for other cards (encounters, finance)
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
              <div className={cardType === 'patients' 
                ? `p-2 rounded-xl shadow-md` 
                : `p-2 bg-gradient-to-br ${settings.gradientFrom} ${settings.gradientTo} rounded-xl shadow-md`}
                style={cardType === 'patients' ? { backgroundColor: settings.primaryColor } : {}}
              >
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
            {cardType === 'communication' ? (
              /* Communication Card with Separate Mini Charts */
              <div>
                {/* Main Value */}
                <div className="mb-3">
                  <p 
                    className="text-3xl font-bold mb-1" 
                    style={{ 
                      fontFamily: 'Rubik, sans-serif',
                      color: settings.primaryColor
                    }}
                  >
                    {mainValue}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
                </div>

                {/* SMS and Email Mini Charts in One Row */}
                <div className="flex items-center justify-between gap-4">
                  {/* SMS Available with Mini Chart */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">SMS Available</span>
                    <div className="relative w-8 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const allocated = (dashboardStats?.communications?.smsAllocated || 0);
                              const used = (dashboardStats?.communications?.smsUsed || 0);
                              
                              console.log('🔍 [SMS Chart] Data:', { 
                                allocated, 
                                used, 
                                calculation: `${used}/${allocated} * 100 = ${allocated > 0 ? (used / allocated * 100).toFixed(1) : 0}%`
                              });
                              
                              if (allocated === 0) {
                                console.log('❌ [SMS Chart] No allocation, showing No Plan');
                                return [{ name: 'No Plan', value: 100, color: '#9CA3AF' }];
                              }
                              
                              const usedPercentage = (used / allocated) * 100;
                              const availablePercentage = Math.max(0, 100 - usedPercentage);
                              
                              console.log('✅ [SMS Chart] Calculated:', { usedPercentage, availablePercentage });
                              
                              return [
                                { name: 'Used', value: usedPercentage, color: '#F97316' }, // Orange theme
                                { name: 'Available', value: availablePercentage, color: '#FCD34D' } // Light orange theme
                              ];
                            })()}
                            cx="50%"
                            cy="50%"
                            innerRadius={10}
                            outerRadius={16}
                            dataKey="value"
                            stroke="none"
                          >
                            {(() => {
                              const allocated = (dashboardStats?.communications?.smsAllocated || 0);
                              const used = (dashboardStats?.communications?.smsUsed || 0);
                              
                              if (allocated === 0) {
                                return [<Cell key="no-plan" fill="#9CA3AF" />];
                              }
                              
                              return [
                                <Cell key="used" fill="#F97316" />, // Orange theme
                                <Cell key="available" fill="#FCD34D" /> // Light orange theme
                              ];
                            })()}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">
                          {(() => {
                            const allocated = (dashboardStats?.communications?.smsAllocated || 0);
                            const used = (dashboardStats?.communications?.smsUsed || 0);
                            const percentage = allocated > 0 ? Math.round((used / allocated) * 100) : 0;
                            console.log('🔍 [SMS Center] Display:', { allocated, used, percentage });
                            return `${percentage}%`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Email Available with Mini Chart */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">Email Available</span>
                    <div className="relative w-8 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const allocated = (dashboardStats?.communications?.emailAllocated || 0);
                              const used = (dashboardStats?.communications?.emailUsed || 0);
                              
                              console.log('🔍 [Email Chart] Data:', { 
                                allocated, 
                                used, 
                                calculation: `${used}/${allocated} * 100 = ${allocated > 0 ? (used / allocated * 100).toFixed(1) : 0}%`
                              });
                              
                              if (allocated === 0) {
                                console.log('❌ [Email Chart] No allocation, showing No Plan');
                                return [{ name: 'No Plan', value: 100, color: '#9CA3AF' }];
                              }
                              
                              const usedPercentage = (used / allocated) * 100;
                              const availablePercentage = Math.max(0, 100 - usedPercentage);
                              
                              console.log('✅ [Email Chart] Calculated:', { usedPercentage, availablePercentage });
                              
                              return [
                                { name: 'Used', value: usedPercentage, color: '#EA580C' }, // Darker orange theme
                                { name: 'Available', value: availablePercentage, color: '#FDBA74' } // Light orange theme
                              ];
                            })()}
                            cx="50%"
                            cy="50%"
                            innerRadius={10}
                            outerRadius={16}
                            dataKey="value"
                            stroke="none"
                          >
                            {(() => {
                              const allocated = (dashboardStats?.communications?.emailAllocated || 0);
                              const used = (dashboardStats?.communications?.emailUsed || 0);
                              
                              if (allocated === 0) {
                                return [<Cell key="no-plan" fill="#9CA3AF" />];
                              }
                              
                              return [
                                <Cell key="used" fill="#EA580C" />, // Darker orange theme
                                <Cell key="available" fill="#FDBA74" /> // Light orange theme
                              ];
                            })()}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">
                          {(() => {
                            const allocated = (dashboardStats?.communications?.emailAllocated || 0);
                            const used = (dashboardStats?.communications?.emailUsed || 0);
                            const percentage = allocated > 0 ? Math.round((used / allocated) * 100) : 0;
                            console.log('🔍 [Email Center] Display:', { allocated, used, percentage });
                            return `${percentage}%`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : cardType === 'patients' ? (
              /* Patients Card with Main Donut Chart */
              <div className="flex items-center justify-between">
                <div className="relative">
                  {/* Premium Donut Chart for Patients */}
                  <div className="relative w-24 h-24 group">
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 to-cyan-400/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={comparison ? [
                            { name: comparison.label1, value: comparison.value1 },
                            { name: comparison.label2, value: comparison.value2 }
                          ] : [
                            { name: 'Male', value: 120 },
                            { name: 'Female', value: 130 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={42}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="rgba(255,255,255,0.3)"
                          strokeWidth={1}
                        >
                          <defs>
                            <linearGradient id="maleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#489bfd" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="femaleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#7db3fe" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <Cell fill="url(#maleGradient)" />
                          <Cell fill="url(#femaleGradient)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Center Value for Patients */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center relative">
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-full scale-150 opacity-60"></div>
                      <div className="relative">
                        <p 
                          className="text-xl font-bold tracking-tight relative z-10" 
                          style={{ 
                            fontFamily: 'Rubik, sans-serif',
                            color: settings.primaryColor,
                            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}
                        >
                          {mainValue}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 ml-4">
                  <p className="text-sm text-gray-600 font-medium mb-2">{subtitle}</p>
                  {renderLegendOnly()}
                </div>
              </div>
            ) : (
              /* Default layout for other cards */
              <div>
                <p 
                  className="text-3xl font-bold mb-1" 
                  style={{ 
                    fontFamily: 'Rubik, sans-serif',
                    color: settings.primaryColor
                  }}
                >
                  {mainValue}
                </p>
                <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
              </div>
            )}

            {cardType !== 'communication' && cardType !== 'patients' && (
              <>
                {/* Legend Only */}
                {renderLegendOnly()}

                {/* Mini Stats or Donut Chart */}
                {renderMiniStats()}
              </>
            )}
          </div>
        </div>

        {/* Bottom Gradient Bar */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} opacity-40 group-hover:opacity-60 transition-opacity duration-300`}></div>
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;