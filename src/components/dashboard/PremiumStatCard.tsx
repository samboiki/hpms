import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Icon } from '@iconify/react';
import { CommunicationStats } from '../../services/communicationStatsService';
import { PatientStats } from '../../services/patientStatsService';
import { InvoiceStats } from '../../services/invoiceStatsService';
import { EncounterStats } from '../../services/encounterStatsService';

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
  icon?: LucideIcon | null;
  iconName?: string;
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
  communicationStats?: CommunicationStats | null;
  patientStats?: PatientStats | null;
  invoiceStats?: InvoiceStats | null;
  encounterStats?: EncounterStats | null;
}

const PremiumStatCard: React.FC<PremiumStatCardProps> = ({
  title,
  mainValue,
  subtitle,
  icon: IconComponent,
  iconName,
  gradient,
  stats,
  comparison,
  onClick,
  trend,
  unsplashQuery,
  cardType = 'patients',
  dashboardStats,
  communicationStats,
  patientStats,
  invoiceStats,
  encounterStats
}) => {

  // Get card-specific colors and settings
  const getCardSettings = () => {
    switch (cardType) {
      case 'patients':
        return {
          primaryColor: '#6366f1',
          secondaryColor: '#a855f7',
          tertiaryColor: '#ec4899',
          gradientFrom: 'from-indigo-500',
          gradientTo: 'to-purple-600',
        };
      case 'communication':
        return {
          primaryColor: '#f59e0b',
          secondaryColor: '#ef4444',
          tertiaryColor: '#10b981',
          gradientFrom: 'from-amber-500',
          gradientTo: 'to-red-500',
        };
      case 'encounters':
        return {
          primaryColor: '#06b6d4',
          secondaryColor: '#3b82f6',
          tertiaryColor: '#8b5cf6',
          gradientFrom: 'from-cyan-500',
          gradientTo: 'to-blue-500',
        };
      case 'finance':
        return {
          primaryColor: '#10b981',
          secondaryColor: '#059669',
          tertiaryColor: '#0d9488',
          gradientFrom: 'from-emerald-500',
          gradientTo: 'to-teal-600',
        };
      default:
        return {
          primaryColor: '#6B7280',
          secondaryColor: '#9CA3AF',
          tertiaryColor: '#d1d5db',
          gradientFrom: 'from-gray-400',
          gradientTo: 'to-gray-500',
        };
    }
  };

  const settings = getCardSettings();

  // Generate single perfect stacked bar data
  const getStackedData = () => {
    switch (cardType) {
      case 'patients':
        if (patientStats) {
          console.log('🎯 PremiumStatCard: Using real patient stats:', patientStats);
          const total = patientStats.total;
          const malePercentage = total > 0 ? Math.round((patientStats.male / total) * 100) : 0;
          const femalePercentage = total > 0 ? Math.round((patientStats.female / total) * 100) : 0;
          
          return {
            subtitle: 'Demographics & Growth',
            mainValue: total.toString(),
            segments: [
              { value: malePercentage, color: '#4F46E5', label: 'Male', count: patientStats.male.toString() },
              { value: femalePercentage, color: '#8B0000', label: 'Female', count: patientStats.female.toString() }
            ],
            totalLabel: 'Total Patients'
          };
        } else {
          console.log('⚠️ PremiumStatCard: No patient stats provided, using fallback');
        }
        // Fallback to default values if no real data
        return {
          subtitle: 'Demographics & Growth',
          mainValue: '0',
          segments: [
            { value: 0, color: '#4F46E5', label: 'Male', count: '0' },
            { value: 0, color: '#8B0000', label: 'Female', count: '0' }
          ],
          totalLabel: 'Total Patients'
        };
      case 'communication':
        if (communicationStats) {
          return {
            subtitle: 'Service Availability',
            mainValue: `${communicationStats.overall_percentage_available || 0}%`,
            segments: [
              { 
                value: communicationStats.sms?.percentage_available || 0, 
                color: '#F59E0B', 
                label: 'SMS Available', 
                count: `${communicationStats.sms?.available || 0}/${communicationStats.sms?.monthly_limit || 0}` 
              },
              { 
                value: communicationStats.email?.percentage_available || 0, 
                color: '#EF4444', 
                label: 'Email Available', 
                count: `${communicationStats.email?.available || 0}/${communicationStats.email?.monthly_limit || 0}` 
              }
            ],
            totalLabel: 'Available/Total'
          };
        }
        // Fallback to default values if no real data
        return {
          subtitle: 'Service Availability',
          mainValue: '88%',
          segments: [
            { value: 85, color: '#F59E0B', label: 'SMS Available', count: '850/1000' },
            { value: 92, color: '#EF4444', label: 'Email Available', count: '460/500' }
          ],
          totalLabel: 'Available/Total'
        };
      case 'encounters':
        if (encounterStats) {
          console.log('🎯 PremiumStatCard: Using real encounter stats:', encounterStats);
          return {
            subtitle: 'Visit Analytics',
            mainValue: encounterStats.total.toString(),
            segments: [
              { 
                value: encounterStats.percentageCompleted, 
                color: '#10B981', 
                label: 'Completed', 
                count: encounterStats.completed.toString() 
              },
              { 
                value: encounterStats.percentagePending, 
                color: '#EF4444', 
                label: 'Pending', 
                count: encounterStats.pending.toString() 
              }
            ],
            totalLabel: 'Total Encounters'
          };
        } else {
          console.log('⚠️ PremiumStatCard: No encounter stats provided, using fallback');
        }
        // Fallback to default values if no real data
        return {
          subtitle: 'Visit Analytics',
          mainValue: '0',
          segments: [
            { value: 0, color: '#10B981', label: 'Completed', count: '0' },
            { value: 0, color: '#EF4444', label: 'Pending', count: '0' }
          ],
          totalLabel: 'Total Encounters'
        };
      case 'finance':
        if (invoiceStats) {
          console.log('🎯 PremiumStatCard: Using real quarterly invoice stats:', invoiceStats);
          return {
            subtitle: `Q${invoiceStats.currentQuarter} ${new Date().getFullYear()} Breakdown`,
            mainValue: `N$${(invoiceStats.quarterlyRevenue || 0).toLocaleString()}`,
            segments: [
              { 
                value: invoiceStats.quarterlyPercentagePaid || 0, 
                color: '#10B981', 
                label: 'Paid', 
                count: `${invoiceStats.quarterlyPaidInvoices || 0} invoices` 
              },
              { 
                value: invoiceStats.quarterlyPercentageOutstanding || 0, 
                color: '#EF4444', 
                label: 'Outstanding', 
                count: `${invoiceStats.quarterlyOutstandingInvoices || 0} invoices` 
              }
            ],
            totalLabel: `Q${invoiceStats.currentQuarter} Revenue`
          };
        } else {
          console.log('⚠️ PremiumStatCard: No invoice stats provided, using fallback');
        }
        // Fallback to default values if no real data
        return {
          subtitle: 'Quarterly Breakdown',
          mainValue: 'N$0',
          segments: [
            { value: 0, color: '#10B981', label: 'Paid', count: '0 invoices' },
            { value: 0, color: '#EF4444', label: 'Outstanding', count: '0 invoices' }
          ],
          totalLabel: 'Quarterly Revenue'
        };
      default:
        return { subtitle: '', mainValue: '', segments: [], totalLabel: '' };
    }
  };

  const stackedData = getStackedData();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="relative group cursor-pointer"
      tabIndex={0}
      onClick={onClick}
    >
      <div className="relative bg-gray-100 backdrop-blur-xl rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200/50 p-5 h-36" style={{ backdropFilter: 'blur(20px)' }}>
        {/* Glassmorphic Background with Rich Patterns */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Primary glass gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${settings.gradientFrom} ${settings.gradientTo} opacity-[0.15] group-hover:opacity-[0.20] transition-opacity duration-300`}></div>
          
          {/* Secondary glass layer */}
          <div className="absolute inset-0 bg-gradient-to-tl from-gray-50/40 via-transparent to-gray-100/30 opacity-60"></div>
          
          {/* Rich Pattern Elements */}
          {/* Top right cluster */}
          <div className={`absolute top-2 right-3 w-12 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.3]`}></div>
          <div className={`absolute top-4 right-5 w-8 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.2]`}></div>
          <div className={`absolute top-3 right-1 w-2 h-2 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.25]`}></div>
          <div className={`absolute top-5 right-8 w-1 h-1 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.4]`}></div>
          
          {/* Left side pattern */}
          <div className={`absolute bottom-2 left-2 w-0.5 h-8 bg-gradient-to-b ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.2]`}></div>
          <div className={`absolute bottom-4 left-4 w-0.5 h-6 bg-gradient-to-b ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.15]`}></div>
          <div className={`absolute bottom-6 left-3 w-0.5 h-4 bg-gradient-to-b ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.25]`}></div>
          
          {/* Center floating elements */}
          <div className={`absolute top-8 left-1/3 w-1.5 h-1.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.2] transform rotate-45`}></div>
          <div className={`absolute bottom-8 right-1/3 w-1 h-1 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.3]`}></div>
          
          {/* Corner accents */}
          <div className={`absolute top-1 left-1 w-3 h-3 border border-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.15]`} style={{ borderImage: `linear-gradient(45deg, ${settings.primaryColor}40, ${settings.secondaryColor}40) 1` }}></div>
          <div className={`absolute bottom-1 right-1 w-2 h-2 border border-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-sm opacity-[0.2] transform rotate-45`} style={{ borderColor: `${settings.primaryColor}40` }}></div>
          
          {/* Scattered micro dots */}
          <div className={`absolute top-6 left-8 w-0.5 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.3]`}></div>
          <div className={`absolute top-10 right-12 w-0.5 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.25]`}></div>
          <div className={`absolute bottom-10 left-12 w-0.5 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.35]`}></div>
          
          {/* Wave pattern */}
          <div className={`absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} opacity-[0.08] transform -translate-y-1/2`} style={{ 
            clipPath: 'polygon(0% 0%, 15% 100%, 35% 0%, 50% 100%, 65% 0%, 85% 100%, 100% 0%, 100% 100%, 0% 100%)'
          }}></div>
          
          {/* Glass reflection highlight */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/30 to-transparent opacity-60 rounded-t-xl"></div>
        </div>
        
        <div className="relative z-10 h-full flex flex-col">
          {/* Header with Main Value on Right */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 bg-gradient-to-br ${settings.gradientFrom} ${settings.gradientTo} rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300`}>
                {IconComponent ? (
                  <IconComponent className="w-6 h-6 text-white" />
                ) : iconName ? (
                  <Icon icon={iconName} className="w-6 h-6 text-white" />
                ) : null}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {title}
                </h3>
                <p className="text-xs text-gray-500 font-normal mt-0.5" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {stackedData.subtitle}
                </p>
              </div>
            </div>
            
            {/* Main Value in Top Right */}
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {stackedData.mainValue}
              </div>
              <div className="text-xs font-light mt-0.5" style={{ fontFamily: 'Rubik, sans-serif', color: '#4f575e' }}>
                {stackedData.totalLabel}
              </div>
              
              {/* Clean Trend Badge below main value */}
              {trend && (
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${trend.isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <div className="text-xs font-medium">
                    <span className={`${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {trend.isPositive ? '↗' : '↘'}
                    </span>
                    <span className="ml-1 text-gray-700">{trend.value}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mini Stats with Center Bars - Bottom Left */}
        <div className="absolute bottom-2 left-2 z-20">
          <div className="flex items-end gap-1">
            {/* First segment: Label + Percentage */}
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-xs font-medium text-gray-600"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              {stackedData.segments[0]?.label}
            </motion.span>
            
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-xs font-bold text-gray-700"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              {stackedData.segments[0]?.value}%
            </motion.span>
            
            {/* Bar container with fixed height for alignment */}
            <div className="flex items-end gap-0.5 h-6">
              {stackedData.segments.slice(0, 2).map((segment, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ 
                    delay: 0.3 + index * 0.1, 
                    duration: 0.4,
                    type: "spring",
                    stiffness: 200,
                    damping: 15
                  }}
                  className="w-1 bg-gray-200 rounded-full overflow-hidden"
                  style={{ height: `${Math.max(8, segment.value * 0.25)}px` }}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '100%' }}
                    transition={{ 
                      delay: 0.5 + index * 0.1, 
                      duration: 0.6,
                      ease: "easeOut"
                    }}
                    className="w-full rounded-full"
                    style={{ backgroundColor: segment.color }}
                  ></motion.div>
                </motion.div>
              ))}
            </div>
            
            {/* Second segment: Percentage + Label */}
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-xs font-bold text-gray-700"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              {stackedData.segments[1]?.value}%
            </motion.span>
            
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-xs font-medium text-gray-600"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              {stackedData.segments[1]?.label}
            </motion.span>
          </div>
        </div>

        {/* Beautiful Trapezoid Cutout */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
          <div 
            className={`w-16 h-3 bg-gradient-to-t ${settings.gradientFrom} ${settings.gradientTo} opacity-[0.3] group-hover:opacity-[0.5] transition-all duration-300`}
            style={{
              clipPath: 'polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)'
            }}
          ></div>
          {/* Inner glow for trapezoid */}
          <div 
            className={`absolute inset-0 w-16 h-3 bg-gradient-to-t from-white/40 to-transparent opacity-60`}
            style={{
              clipPath: 'polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)'
            }}
          ></div>
        </div>
        
        {/* Glassmorphic border accent */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} opacity-[0.25] group-hover:opacity-[0.4] transition-opacity duration-300 rounded-b-xl`}></div>
        
        {/* Glassmorphic shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
        
        {/* Glass edge highlight */}
        <div className="absolute inset-0 rounded-xl border border-gray-300/50 group-hover:border-gray-400/60 transition-colors duration-300"></div>
      </div>
    </motion.div>
  );
};

export default React.memo(PremiumStatCard);