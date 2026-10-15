import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Icon } from '@iconify/react';
import { CommunicationStats } from '../../services/communicationStatsService';
import { PatientStats } from '../../services/patientStatsService';
import { InvoiceStats } from '../../services/invoiceStatsService';
import { EncounterStats } from '../../services/encounterStatsService';
import { formatNad } from '../../utils/billing/money';

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
  /** Opens a quick overview window from a small button by the title; clicking the card still runs onClick */
  onDetails?: () => void;
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
  onDetails,
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
        // No usage data (still loading, or it could not be loaded): show a dash, not made-up figures
        return {
          subtitle: 'Service Availability',
          mainValue: '-',
          segments: [],
          totalLabel: 'No usage data yet'
        };
      case 'encounters':
        if (encounterStats) {
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
          return {
            subtitle: `Q${invoiceStats.currentQuarter} ${new Date().getFullYear()} Breakdown`,
            mainValue: formatNad(Number(invoiceStats.quarterlyRevenue) || 0),
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
        }
        // Fallback to default values if no real data
        return {
          subtitle: 'Quarterly Breakdown',
          mainValue: formatNad(0),
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        // The card is focusable, so keyboard users must be able to open it too
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Grows with its content (min height instead of a fixed one) so narrow tiles never clip figures. The same plain light
          card at every width, the look he likes on his phone (owner, 15 Oct 2026): no colour tint, a small resting shadow,
          every decoration sized outright. Two global rules for narrow screens (index.css and styles/mobile-performance.css:
          they hide absolute inset-0 bg-gradient-to-br layers, replace .shadow-lg and pad any class containing "p-6") used to
          make phones differ from desktops; this card no longer depends on them */}
      <div className="relative bg-gray-100 backdrop-blur-xl rounded-xl [box-shadow:0_2px_4px_-1px_rgba(0,0,0,0.1)] group-hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200/50 p-4 sm:p-5 h-full min-h-[9rem] flex flex-col [container-type:inline-size]" style={{ backdropFilter: 'blur(20px)' }}>
        {/* Glassmorphic Background with Rich Patterns */}
        <div className="absolute inset-0 overflow-hidden">
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
          
          {/* Scattered micro dots. The first is the soft 1rem dot beside the title that phones always showed (a narrow-screen
              rule padded anything with "p-6" in its class, so top-6 made it that size there only); now sized outright */}
          <div className={`absolute top-[1.5rem] left-8 w-4 h-4 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.3]`}></div>
          <div className={`absolute top-10 right-12 w-0.5 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.25]`}></div>
          <div className={`absolute bottom-10 left-12 w-0.5 h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} rounded-full opacity-[0.35]`}></div>
          
          {/* Wave pattern */}
          <div className={`absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r ${settings.gradientFrom} ${settings.gradientTo} opacity-[0.08] transform -translate-y-1/2`} style={{ 
            clipPath: 'polygon(0% 0%, 15% 100%, 35% 0%, 50% 100%, 65% 0%, 85% 100%, 100% 0%, 100% 100%, 0% 100%)'
          }}></div>
          
          {/* Glass reflection highlight */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/30 to-transparent opacity-60 rounded-t-xl"></div>
        </div>
        
        <div className="relative z-10">
          {/* Header with Main Value on Right when the tile is wide enough (container query on the tile, not
              the screen); on a narrower tile the value gets its own line under the title, so a figure such
              as N$ 125,479.58 is never squeezed, split or clipped */}
          <div className="flex flex-col gap-2 [@container(min-width:19rem)]:flex-row [@container(min-width:19rem)]:items-start [@container(min-width:19rem)]:justify-between [@container(min-width:19rem)]:gap-3">
            <div className="flex min-w-0 items-center gap-3 [@container(min-width:19rem)]:flex-1">
              <div className={`flex-none p-2.5 bg-gradient-to-br ${settings.gradientFrom} ${settings.gradientTo} rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300`}>
                {IconComponent ? (
                  <IconComponent className="w-5 h-5 text-white" />
                ) : iconName ? (
                  <Icon icon={iconName} className="w-5 h-5 text-white" aria-hidden="true" />
                ) : null}
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg leading-tight font-semibold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {title}
                </h3>
                <p className="text-xs text-gray-500 font-normal mt-0.5" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {stackedData.subtitle}
                </p>
              </div>
              {onDetails && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDetails(); }}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label={`Open ${title} overview`}
                  title={`Open ${title} overview`}
                  className="flex-none ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white/60 transition-colors"
                >
                  <Icon icon="solar:chart-2-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Main Value in Top Right */}
            <div className="[@container(min-width:19rem)]:flex-none [@container(min-width:19rem)]:text-right">
              <div className="whitespace-nowrap text-2xl leading-tight font-bold tabular-nums text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {stackedData.mainValue}
              </div>
              <div className="text-xs font-light mt-0.5" style={{ fontFamily: 'Rubik, sans-serif', color: '#4f575e' }}>
                {stackedData.totalLabel}
              </div>

              {/* Clean Trend Badge below main value */}
              {trend && (
                <div className="flex items-center gap-1.5 mt-1 [@container(min-width:19rem)]:justify-end">
                  <div className={`w-1.5 h-1.5 flex-none rounded-full ${trend.isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <div className="text-xs font-medium whitespace-nowrap tabular-nums">
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

        {/* Mini Stats with Center Bars - bottom of the tile, in the flow so it can wrap instead of being clipped */}
        <div className="relative z-20 mt-auto pt-3">
          <div className="flex flex-wrap items-end gap-x-1 gap-y-0.5 tabular-nums">
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
              {stackedData.segments[0] ? `${stackedData.segments[0].value}%` : null}
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
              {stackedData.segments[1] ? `${stackedData.segments[1].value}%` : null}
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