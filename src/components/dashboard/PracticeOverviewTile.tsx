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
      className="relative overflow-hidden mb-4 group"
    >
      {/* Funkified container with sidebar-matching gradient */}
      <div className="relative bg-gradient-to-br from-slate-800 via-[#01b9d5] to-slate-900 rounded-2xl shadow-2xl border border-[#01b9d5]/20 overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-gradient-to-r from-[#01b9d5] to-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-gradient-to-r from-teal-400 to-[#01b9d5] rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-500"></div>
        </div>

        {/* Cosmic border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 via-cyan-500/20 to-teal-500/20 rounded-2xl blur-sm"></div>
        
        {/* Header with sidebar-matching gradient */}
        <div className="relative p-5 border-b border-white/10 bg-gradient-to-r from-[#01b9d5]/10 via-transparent to-cyan-500/10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold bg-gradient-to-r from-white via-cyan-100 to-teal-100 bg-clip-text text-transparent flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5] to-cyan-400 blur-lg opacity-60 animate-pulse" />
                <Building2 className="relative w-6 h-6 text-white drop-shadow-lg" />
              </div>
              Practice Overview
            </h3>
            
            {/* Floating sparkles */}
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="w-5 h-5 text-cyan-300 drop-shadow-lg" />
              </motion.div>
              <motion.div
                animate={{ rotate: -360, scale: [1, 0.8, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <Star className="w-4 h-4 text-teal-300 drop-shadow-lg" />
              </motion.div>
            </div>
          </div>
        </div>
        
        {/* Content area with enhanced styling */}
        <div className="relative p-5">
          {/* Enhanced practice status text with glow effect */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/5 via-cyan-500/5 to-teal-500/5 rounded-xl blur-sm"></div>
            <div className="relative p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <p className="text-sm text-gray-100 leading-relaxed font-medium">
                {generateOverviewText()}
              </p>
            </div>
          </div>

          {/* Enhanced performance indicator with cosmic styling */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/10 via-cyan-500/10 to-teal-500/10 rounded-xl blur-sm"></div>
            <div className="relative p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-300" />
                  <span className="text-sm font-bold bg-gradient-to-r from-cyan-200 to-teal-200 bg-clip-text text-transparent">
                    Today's Performance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-300" />
                  <span className="text-sm font-bold text-emerald-200">
                    {practiceStats?.todayAppointments ? 
                      Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}% Complete
                  </span>
                </div>
              </div>
              
              {/* Cosmic progress bar */}
              <div className="relative">
                <div className="h-3 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                  <motion.div
                    initial={{ width: 0, scale: 0.8 }}
                    animate={{ 
                      width: `${practiceStats?.todayAppointments ? 
                        Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}%`,
                      scale: 1
                    }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${getStatusColor()} relative overflow-hidden rounded-full`}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-pulse"></div>
                  </motion.div>
                </div>
                
                {/* Glow effect under progress bar */}
                <div className={`absolute inset-0 bg-gradient-to-r ${getStatusColor()} opacity-20 rounded-full blur-sm -z-10`}></div>
              </div>
            </div>
          </div>

          {/* Floating orbs decoration */}
          <div className="absolute top-2 right-2 w-16 h-16 bg-gradient-to-r from-[#01b9d5]/20 to-cyan-400/20 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute bottom-2 left-2 w-12 h-12 bg-gradient-to-r from-teal-400/20 to-[#01b9d5]/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        </div>

        {/* Border glow effect */}
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-r from-[#01b9d5]/30 via-cyan-500/30 to-teal-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-sm"></div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;