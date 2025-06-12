import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Sparkles, TrendingUp, Star, Zap } from 'lucide-react';
import { useTheme } from '../../stores/themeStore';

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
  const { currentTheme } = useTheme();
  
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
      {/* Sidebar-themed container */}
      <div className={`relative bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md rounded-xl shadow-lg border border-white/10 overflow-hidden`}>
        
        {/* Content area */}
        <div className="relative p-4">
          {/* Practice status text */}
          <div className="relative">
            <div className="relative p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 shadow-sm">
              <p className="text-sm text-white/90 leading-relaxed">
                {generateOverviewText()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;