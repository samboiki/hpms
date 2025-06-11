import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Sparkles, TrendingUp, Star, Zap } from 'lucide-react';

interface PracticeOverviewProps {
  practiceStats?: {
    totalPatients: number;
    todayAppointments: number;
    completedToday: number;
    pendingAppointments: number;
    revenue?: number;
  };
}

const PracticeOverviewTile: React.FC<PracticeOverviewProps> = ({ practiceStats }) => {
  // Generate comprehensive practice overview text
  const generateOverviewText = () => {
    const stats = practiceStats || {
      totalPatients: 0,
      todayAppointments: 0,
      completedToday: 0,
      pendingAppointments: 0
    };

    const currentHour = new Date().getHours();
    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';
    
    // Dynamic status based on data
    const busyLevel = stats.todayAppointments > 10 ? 'busy' : stats.todayAppointments > 5 ? 'moderate' : 'quiet';
    const efficiency = stats.todayAppointments > 0 ? Math.round((stats.completedToday / stats.todayAppointments) * 100) : 0;
    
    return `Your practice is having a ${busyLevel} ${timeOfDay} with ${stats.todayAppointments} appointments scheduled and ${stats.completedToday} already completed for a ${efficiency}% completion rate. You currently have ${stats.totalPatients} total patients in your system with ${stats.pendingAppointments} appointments awaiting approval. Operations are running ${efficiency > 80 ? 'smoothly' : efficiency > 60 ? 'efficiently' : 'steadily'} across all departments.`;
  };

  const getStatusColor = () => {
    const stats = practiceStats || { todayAppointments: 0, completedToday: 0 };
    const efficiency = stats.todayAppointments > 0 ? Math.round((stats.completedToday / stats.todayAppointments) * 100) : 0;
    
    if (efficiency > 80) return 'from-emerald-500 via-teal-500 to-cyan-500';
    if (efficiency > 60) return 'from-[#01b9d5] via-cyan-500 to-teal-500';
    return 'from-amber-500 via-orange-500 to-[#01b9d5]';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 24 }}
      className="relative overflow-hidden group"
    >
      {/* Modern white container matching dashboard styling */}
      <div className="relative bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Modern gradient header */}
        <div className="relative p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 bg-[#01b9d5] blur-xl opacity-20 animate-pulse" />
                <Building2 className="relative w-5 h-5 text-[#01b9d5]" />
              </div>
              Practice Overview
            </h3>
          </div>
        </div>
        
        {/* Content area */}
        <div className="relative p-4">
          {/* Practice status text */}
          <div className="relative mb-4">
            <div className="relative p-4 bg-slate-50/70 rounded-lg border border-slate-200/50 shadow-sm">
              <p className="text-sm text-slate-700 leading-relaxed">
                {generateOverviewText()}
              </p>
            </div>
          </div>

          {/* Performance indicator */}
          <div className="relative">
            <div className="relative p-4 bg-slate-50/70 rounded-lg border border-slate-200/50 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#01b9d5]" />
                  <span className="text-sm font-medium text-slate-800">
                    Today's Performance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">
                    {practiceStats?.todayAppointments ? 
                      Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}% Complete
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="relative">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${practiceStats?.todayAppointments ? 
                        Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}%`
                    }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${getStatusColor()} relative overflow-hidden rounded-full`}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-pulse"></div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;