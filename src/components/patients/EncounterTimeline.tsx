import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { supabase } from '../../lib/supabase';
import {
  Clock,
  Heart,
  Stethoscope,
  Pill,
  FileText,
  ChevronRight,
  Thermometer,
  FlaskConical,
  User,
  Plus,
  Edit3,
  Copy,
  Calendar,
  PieChart,
  BarChart3,
  Zap,
  Shield,
  Star,
  Sparkles,
  Diamond,
  Crown,
  Award,
  Target,
  Hexagon,
  Play,
  CalendarCheck
} from 'lucide-react';

// Professional Status Toggle Component
const StatusToggle: React.FC<{
  visitId: string;
  currentStatus: string;
  onStatusChange?: (visitId: string, newStatus: string) => void;
  disabled?: boolean;
}> = ({ visitId, currentStatus, onStatusChange, disabled = false }) => {
  const [localStatus, setLocalStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const isCompleted = localStatus === 'completed';
  
  const handleToggle = async (e: React.MouseEvent) => {
    // Prevent event bubbling to parent card
    e.stopPropagation();
    e.preventDefault();
    
    if (isUpdating || disabled) return;
    
    const newStatus = isCompleted ? 'in-progress' : 'completed';
    const previousStatus = localStatus;
    
    try {
      setIsUpdating(true);
      
      // Immediate optimistic update for snappy UX
      setLocalStatus(newStatus);
      
      // Update database silently in background
      const { error } = await supabase
        .from('visits')
        .update({ status: newStatus })
        .eq('id', visitId);
      
      if (error) throw error;
      
      // Silently notify parent without refreshing
      if (onStatusChange) {
        onStatusChange(visitId, newStatus);
      }
      
    } catch (error) {
      console.error('Error updating visit status:', error);
      
      // Revert optimistic update on error
      setLocalStatus(previousStatus);
      
      // Simple error notification
      console.error('Failed to update visit status');
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div 
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full cursor-pointer select-none transition-all duration-150 ease-out ${
        isCompleted 
          ? 'bg-white border border-[#01b9d5] hover:bg-[#01b9d5]/8' 
          : 'bg-gray-100 border border-gray-200 hover:bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleToggle}
    >
      {/* Compact toggle switch */}
      <div className={`relative w-7 h-4 rounded-full transition-colors duration-150 ease-out ${
        isCompleted ? 'bg-[#01b9d5]' : 'bg-gray-400'
      }`}>
        <div
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-150 ease-out ${
            isCompleted ? 'transform translate-x-3' : 'transform translate-x-0.5'
          }`}
          style={{ willChange: 'transform' }}
        />
      </div>
      
      {/* Compact status text */}
      <span className={`text-xs font-medium transition-colors duration-150 ${
        isCompleted ? 'text-[#01b9d5]' : 'text-gray-600'
      }`}>
        {isCompleted ? 'Done' : 'Pending'}
      </span>
    </div>
  );
};

// Unified Visit interface for both appointments and visits
interface Visit {
  id: string;
  visit_date: string;
  visit_time?: string;
  visit_number?: number;  // Sequential number for patient journey
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  doctor_name?: string;
  doctor?: {
    id: string;
    full_name: string;
  };
  visit_type?: string;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';  // Unified statuses
  history_of_present_illness?: string;
  follow_up_instructions?: string;
  notes?: string;
  duration?: number;
  appointment_id?: string;  // Link to original appointment if migrated
  vitals?: {
    blood_pressure?: string;
    heart_rate?: number;
    temperature?: number;
    weight?: number;
  };
  medications?: Array<{
    name: string;
    dosage: string;
  }>;
  lab_results?: Array<{
    test_name: string;
    status: string;
  }>;
  // Add counts for media, lab, and imaging
  media_count?: number;
  lab_count?: number;
  imaging_count?: number;
}

// Helper to check if a visit is scheduled (appointment)
const isScheduledVisit = (visit: Visit): boolean => {
  return visit.status === 'scheduled';
};

interface EncounterTimelineProps {
  visits: Visit[];
  appointments?: any[];  // Deprecated - kept for backward compatibility
  patientName?: string;
  onAddVisit?: () => void;
  onAddVisitTabs?: () => void;
  onEditVisit?: (visit: Visit) => void;
  onCreateFollowUp?: (visit: Visit) => void;
  onStartAppointment?: (visit: Visit) => void;  // Now handles scheduled visits
  onVisitStatusChange?: (visitId: string, newStatus: string) => void;
  // Add counts prop for MASSIVE performance optimization - eliminates N+1 queries
  visitCounts?: { [visitId: string]: { media: number; lab: number; imaging: number } };
}

// Donut Chart Component
const CompletionDonutChart: React.FC<{ visits: Visit[] }> = ({ visits }) => {
  const completedVisits = visits.filter(visit => visit.status === 'completed').length;
  const totalVisits = visits.length;
  const completionPercentage = totalVisits > 0 ? (completedVisits / totalVisits) * 100 : 0;
  
  const circumference = 2 * Math.PI * 32;
  const strokeDasharray = `${(completionPercentage / 100) * circumference} ${circumference}`;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="80" height="80" className="transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="32"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="40"
            cy="40"
            r="32"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="text-indigo-600 transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-lg font-bold text-indigo-600">{Math.round(completionPercentage)}%</div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="space-y-1.5 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
          <span className="text-xs text-gray-700">Completed ({completedVisits})</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 bg-gray-200 rounded-full"></div>
          <span className="text-xs text-gray-700">Pending ({totalVisits - completedVisits})</span>
        </div>
      </div>
    </div>
  );
};

// Format date like "13th June '25"
const formatVisitDate = (dateString: string) => {
  try {
    if (!dateString) return 'No date';
    
    const date = parseISO(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    const day = format(date, 'do');
    const month = format(date, 'MMMM');
    const year = format(date, "''yy");
    return `${day} ${month} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'Invalid date';
  }
};

const TimelineNode: React.FC<{
  visit: Visit;
  index: number;
  totalVisits: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEditVisit?: (visit: Visit) => void;
  onCreateFollowUp?: (visit: Visit) => void;
  onVisitStatusChange?: (visitId: string, newStatus: string) => void;
  onStartAppointment?: (visit: Visit) => void;
  // Add optional counts prop for MASSIVE performance optimization
  visitCounts?: { [visitId: string]: { media: number; lab: number; imaging: number } };
}> = ({ visit, index, totalVisits, isLast, isExpanded, onToggle, onEditVisit, onCreateFollowUp, onVisitStatusChange, onStartAppointment, visitCounts }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // ⚡ PERFORMANCE OPTIMIZATION: Use pre-calculated counts instead of individual queries
  // This eliminates the N+1 query problem that was causing 3-4 second delays
  const counts = {
    media: visitCounts?.[visit.id]?.media ?? visit.media_count ?? 0,
    lab: visitCounts?.[visit.id]?.lab ?? visit.lab_count ?? 0,
    imaging: visitCounts?.[visit.id]?.imaging ?? visit.imaging_count ?? 0
  };
  const visitDate = parseISO(visit.visit_date);
  const isTodayVisit = isToday(visitDate);
  const isFutureVisit = isFuture(visitDate);
  const visitNumber = visit.visit_number || (totalVisits - index);  // Use visit_number if available
  const isCompleted = visit.status === 'completed';
  const isScheduled = visit.status === 'scheduled';  // This is an appointment
  
  // Get premium colors and demarcation based on status
  const getVisitTheme = () => {
    if (isScheduled) {
      // Scheduled visits (appointments) get a special theme
      return {
        bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
        border: 'border-emerald-300',
        glow: 'bg-emerald-400',
        cardBg: 'bg-gradient-to-br from-emerald-50/30 to-teal-50/30',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-700',
        accent: 'from-emerald-500 to-teal-600',
        icon: CalendarCheck,
        iconColor: 'text-emerald-600',
        status: 'scheduled'
      };
    }
    if (isCompleted) {
      return {
        bg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
        border: 'border-indigo-300',
        glow: 'bg-indigo-400',
        cardBg: 'bg-gradient-to-br from-indigo-50/30 to-purple-50/30',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-700',
        accent: 'from-indigo-500 to-purple-600',
        icon: Crown,
        iconColor: 'text-indigo-600',
        status: 'completed'
      };
    }
    if (isTodayVisit) {
      return {
        bg: 'bg-gradient-to-br from-purple-500 to-pink-600',
        border: 'border-purple-300',
        glow: 'bg-purple-400',
        cardBg: 'bg-gradient-to-br from-purple-50/30 to-pink-50/30',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-700',
        accent: 'from-purple-500 to-pink-600',
        icon: Zap,
        iconColor: 'text-purple-600',
        status: 'today'
      };
    }
    if (isFutureVisit) {
      return {
        bg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
        border: 'border-blue-300',
        glow: 'bg-blue-400',
        cardBg: 'bg-gradient-to-br from-blue-50/30 to-cyan-50/30',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-700',
        accent: 'from-blue-500 to-cyan-600',
        icon: Target,
        iconColor: 'text-blue-600',
        status: 'future'
      };
    }
    return {
      bg: 'bg-gradient-to-br from-gray-400 to-gray-600',
      border: 'border-gray-300',
      glow: 'bg-gray-400',
      cardBg: 'bg-white',
      textPrimary: 'text-gray-900',
      textSecondary: 'text-gray-600',
      accent: 'from-gray-400 to-gray-600',
      icon: Shield,
      iconColor: 'text-gray-600',
      status: 'past'
    };
  };
  
  const theme = getVisitTheme();
  
  // Get visit type display name
  const getVisitTypeDisplay = () => {
    if (visit.visit_type) {
      return visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1);
    }
    return 'General Visit';
  };
  
  return (
    <div className="relative flex items-start gap-6">
      {/* Timeline node */}
      <div className="relative flex-shrink-0">
        {/* Animated connection line to next visit */}
        {!isLast && (
          <motion.div
            className={`absolute top-16 left-8 w-0.5 -z-10 ${
              isCompleted 
                ? 'bg-gradient-to-b from-indigo-500 via-purple-500 to-indigo-400' 
                : isTodayVisit
                ? 'bg-gradient-to-b from-purple-500 via-pink-500 to-purple-400'
                : isFutureVisit
                ? 'bg-gradient-to-b from-blue-500 via-cyan-500 to-blue-400'
                : 'bg-gradient-to-b from-gray-300 to-gray-200'
            }`}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ 
              scaleY: 1, 
              opacity: 1,
              backgroundPosition: isCompleted ? ['0% 0%', '100% 100%'] : ['0% 0%']
            }}
            transition={{ 
              delay: index * 0.05 + 0.2, 
              duration: 0.6,
              backgroundPosition: {
                duration: isCompleted ? 2 : 0,
                repeat: isCompleted ? Infinity : 0,
                ease: "linear"
              }
            }}
            style={{
              height: 'calc(100% + 2rem + var(--card-height, 200px))',
              transformOrigin: 'top'
            }}
          >
            {/* Animated pulse for completed visits */}
            {isCompleted && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-full"
                animate={{
                  opacity: [0.8, 0.3, 0.8],
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
            
            {/* Moving dot for today's visits */}
            {isTodayVisit && (
              <motion.div
                className="absolute w-2 h-2 bg-white rounded-full shadow-lg"
                style={{ left: '-3px' }}
                animate={{
                  y: [0, 60, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </motion.div>
        )}
        
        <motion.div
          className="relative z-10"
          whileHover={{ scale: 1.08 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          {/* Subtle glow */}
          {isHovered && (
            <motion.div
              className={`absolute inset-0 ${theme.glow} rounded-full blur-xl`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.4, scale: 1.6 }}
              transition={{ duration: 0.3 }}
            />
          )}
          
          {/* Circle with visit number and white space */}
          <motion.div
            className={`relative z-10 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border-4 ${theme.border}`}
          >
            {/* Inner colored circle with visit number */}
            <div className={`w-12 h-12 ${theme.bg} rounded-full flex items-center justify-center shadow-md`}>
              <span className="text-xl font-bold text-white">
                {visitNumber}
              </span>
            </div>
            
            
            {/* Pulse effect for today */}
            {isTodayVisit && (
              <motion.div
                className="absolute inset-2 bg-white rounded-full"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0, 0.2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
          </motion.div>
        </motion.div>
      </div>
      
      {/* Content card */}
      <div className="flex-1 min-w-0">
        <motion.div
          animate={{ 
            x: isHovered ? 8 : 0,
            y: isHovered ? -2 : 0 
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            className={`${theme.cardBg} rounded-xl overflow-hidden transition-all duration-200 cursor-pointer relative group border ${
              isCompleted 
                ? 'border-indigo-500' 
                : isTodayVisit
                ? 'border-purple-500'
                : isFutureVisit
                ? 'border-blue-500'
                : 'border-gray-300'
            }`}
            onClick={onToggle}
            whileHover={{ scale: 1.005 }}
          >
            {/* Creative Demarcation System */}
            
            {/* Method 1: Corner Accent with Icon */}
            <div className="absolute top-0 right-0 z-20">
              <div className={`w-12 h-12 bg-gradient-to-br ${theme.accent} opacity-90 rounded-bl-3xl rounded-tr-xl flex items-center justify-center shadow-lg`}>
                <theme.icon className={`w-5 h-5 text-white drop-shadow-sm`} />
              </div>
            </div>
            
            {/* Method 2: Geometric Side Pattern */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 z-10">
              <div className={`h-full bg-gradient-to-b ${theme.accent} relative overflow-hidden`}>
                {/* Animated diamond pattern */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    background: `linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.2) 25%, rgba(255,255,255,0.2) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.2) 75%)`,
                    backgroundSize: '8px 8px',
                    backgroundPosition: isHovered ? '8px 8px' : '0px 0px'
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            
            
            {/* Method 4: Subtle Border Glow Effect */}
            <div className="absolute inset-0 rounded-xl z-0">
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${theme.accent} opacity-20 blur-sm`} />
              <div className="absolute inset-[1px] rounded-xl bg-white" />
            </div>
            
            {/* Card content */}
            <div className="relative z-10">
              {/* Floating particles effect */}
              {isHovered && (
                <>
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-purple-400 rounded-full"
                      initial={{ x: 20, y: 20, opacity: 0 }}
                      animate={{
                        x: [20, 40 + i * 20, 60 + i * 15],
                        y: [20, 10 - i * 5, 0],
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.2,
                        repeat: Infinity,
                      }}
                    />
                  ))}
                </>
              )}
              
              {/* Main content area */}
              <div className="pt-4 px-4">
                {/* Row 1: Visit type and chief complaint */}
                <div className="flex items-center gap-2 mb-3">
                  <motion.h3 
                    className={`font-semibold text-base ${theme.textPrimary} relative z-10 flex-shrink-0`}
                    animate={{ scale: isHovered ? 1.02 : 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {getVisitTypeDisplay()}:
                  </motion.h3>
                  {visit.chief_complaint && (
                    <>
                      <Stethoscope className={`w-4 h-4 ${theme.iconColor} flex-shrink-0`} />
                      <motion.p 
                        className={`text-sm ${theme.textSecondary} font-medium relative z-10 truncate`}
                        animate={{ opacity: isHovered ? 1 : 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {visit.chief_complaint}
                      </motion.p>
                    </>
                  )}
                </div>
                
                {/* Row 2: Doctor info (if available) */}
                {(visit.doctor?.full_name || visit.doctor_name) && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-semibold text-sm">
                        Dr. {visit.doctor?.full_name || visit.doctor_name}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Row 3: Status Toggle or Start Visit button */}
                <div className="mb-3">
                  {isScheduled ? (
                    // For scheduled visits (appointments), show "Start Visit" button
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStartAppointment) {
                          onStartAppointment(visit); // This will update status and open edit form
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full shadow-sm hover:shadow-lg transition-all text-white font-semibold text-xs"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Play className="w-3 h-3" />
                      Start Visit
                    </motion.button>
                  ) : (
                    // For in-progress or completed visits, show status toggle
                    <StatusToggle
                      visitId={visit.id}
                      currentStatus={visit.status || 'in-progress'}
                      onStatusChange={onVisitStatusChange}
                    />
                  )}
                </div>
                
                {/* Row 4: Quick stats */}
                {(visit.vitals?.blood_pressure || (visit.medications && visit.medications.length > 0) || (visit.lab_results && visit.lab_results.length > 0)) && (
                  <div className="flex items-center gap-2 mb-3">
                    {visit.vitals?.blood_pressure && (
                      <motion.div 
                        className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-red-50 to-pink-50 rounded-lg px-2.5 py-1.5 border border-red-100"
                        whileHover={{ scale: 1.05, y: -1 }}
                      >
                        <Heart className="w-3.5 h-3.5 text-red-500" />
                        <span className="font-semibold text-red-700">{visit.vitals.blood_pressure}</span>
                      </motion.div>
                    )}
                    {visit.medications && visit.medications.length > 0 && (
                      <motion.div 
                        className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg px-2.5 py-1.5 border border-blue-100"
                        whileHover={{ scale: 1.05, y: -1 }}
                      >
                        <Pill className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-semibold text-blue-700">{visit.medications.length} meds</span>
                      </motion.div>
                    )}
                    {visit.lab_results && visit.lab_results.length > 0 && (
                      <motion.div 
                        className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg px-2.5 py-1.5 border border-emerald-100"
                        whileHover={{ scale: 1.05, y: -1 }}
                      >
                        <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-semibold text-emerald-700">{visit.lab_results.length} tests</span>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Bottom row: Media/Lab/Imaging badges and Action buttons */}
              <div className="flex items-center justify-between px-4 pb-3 border-t border-gray-100 pt-3">
                {/* Media, Lab, Imaging badges as light grey buttons */}
                <div className="flex items-center gap-2">
                  <motion.button 
                    className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all duration-200 ${
                      counts.media > 0 
                        ? 'bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border border-blue-200/50' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
                      <FileText className={`w-3.5 h-3.5 transition-colors ${
                        counts.media > 0 
                          ? 'text-blue-600 group-hover:text-blue-700' 
                          : 'text-gray-500 group-hover:text-gray-700'
                      }`} />
                    </motion.div>
                    <span className={`transition-colors ${
                      counts.media > 0 
                        ? 'text-blue-700 group-hover:text-blue-800' 
                        : 'text-gray-600 group-hover:text-gray-800'
                    }`}>Media</span>
                    <span className={`font-semibold transition-colors ${
                      counts.media > 0 
                        ? 'text-blue-800 group-hover:text-blue-900' 
                        : 'text-gray-700 group-hover:text-gray-900'
                    }`}>{counts.media}</span>
                  </motion.button>
                  
                  <motion.button 
                    className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all duration-200 ${
                      counts.lab > 0 
                        ? 'bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border border-emerald-200/50' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
                      <FlaskConical className={`w-3.5 h-3.5 transition-colors ${
                        counts.lab > 0 
                          ? 'text-emerald-600 group-hover:text-emerald-700' 
                          : 'text-gray-500 group-hover:text-gray-700'
                      }`} />
                    </motion.div>
                    <span className={`transition-colors ${
                      counts.lab > 0 
                        ? 'text-emerald-700 group-hover:text-emerald-800' 
                        : 'text-gray-600 group-hover:text-gray-800'
                    }`}>Lab</span>
                    <span className={`font-semibold transition-colors ${
                      counts.lab > 0 
                        ? 'text-emerald-800 group-hover:text-emerald-900' 
                        : 'text-gray-700 group-hover:text-gray-900'
                    }`}>{counts.lab}</span>
                  </motion.button>
                  
                  <motion.button 
                    className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all duration-200 ${
                      counts.imaging > 0 
                        ? 'bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200/50' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
                      <Hexagon className={`w-3.5 h-3.5 transition-colors ${
                        counts.imaging > 0 
                          ? 'text-purple-600 group-hover:text-purple-700' 
                          : 'text-gray-500 group-hover:text-gray-700'
                      }`} />
                    </motion.div>
                    <span className={`transition-colors ${
                      counts.imaging > 0 
                        ? 'text-purple-700 group-hover:text-purple-800' 
                        : 'text-gray-600 group-hover:text-gray-800'
                    }`}>Imaging</span>
                    <span className={`font-semibold transition-colors ${
                      counts.imaging > 0 
                        ? 'text-purple-800 group-hover:text-purple-900' 
                        : 'text-gray-700 group-hover:text-gray-900'
                    }`}>{counts.imaging}</span>
                  </motion.button>
                </div>
                
                {/* Action buttons */}
                <div className="flex items-center gap-2 relative z-20">
                  {onEditVisit && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditVisit(visit);
                      }}
                      className="group flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-all duration-200"
                      title="Edit encounter"
                    >
                      <motion.div whileHover={{ rotate: -15 }} transition={{ duration: 0.2 }}>
                        <Edit3 className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700" />
                      </motion.div>
                      <span className="font-medium text-gray-600 group-hover:text-gray-800">Edit</span>
                    </motion.button>
                  )}
                  {onCreateFollowUp && isCompleted && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFollowUp(visit);
                      }}
                      className="group flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-all duration-200"
                      title="Create follow-up"
                    >
                      <motion.div whileHover={{ scale: 1.2 }} transition={{ duration: 0.2 }}>
                        <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700" />
                      </motion.div>
                      <span className="font-medium text-gray-600 group-hover:text-gray-800">Follow-up</span>
                    </motion.button>
                  )}
                  <motion.button
                    className="group p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-all duration-200"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700 transition-colors" />
                    </motion.div>
                  </motion.button>
                </div>
              </div>
            </div>
            
            {/* Separator */}
            {isExpanded && (
              <div className="border-t-2 border-gray-100"></div>
            )}
            
            {/* Expanded content - Clinical Details */}
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -10 }}
                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -10 }}
                  transition={{ 
                    duration: 0.3, 
                    ease: [0.4, 0.0, 0.2, 1],
                    height: { duration: 0.3 },
                    opacity: { duration: 0.2, delay: 0.1 }
                  }}
                  className="bg-white relative z-10"
                >
                  {/* Section Header */}
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                        <Stethoscope className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Clinical Assessment & Treatment</h3>
                        <p className="text-xs text-gray-600 mt-0.5">Diagnostic findings and treatment protocols</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4 bg-white relative z-10">
                    {/* Always show some content for testing */}
                    <div className="space-y-4">
                      {/* Diagnosis Section */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900">Diagnosis</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {visit.diagnosis || 'No diagnosis recorded'}
                        </p>
                      </div>
                      
                      {/* Treatment Plan Section */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900">Treatment Plan</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {visit.treatment_plan || 'No treatment plan recorded'}
                        </p>
                      </div>
                      
                      {/* Medications Section */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900">Medications</h4>
                        {visit.medications && visit.medications.length > 0 ? (
                          <div className="space-y-1">
                            {visit.medications.map((med, idx) => (
                              <div key={idx} className="text-sm text-gray-700">
                                <span className="font-medium">{med.name}</span> - {med.dosage}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">No medications prescribed</p>
                        )}
                      </div>
                      
                      {/* Lab Results */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-900">Lab Results</h4>
                        {visit.lab_results && visit.lab_results.length > 0 ? (
                          <p className="text-sm text-gray-600">
                            {visit.lab_results.length} test{visit.lab_results.length > 1 ? 's' : ''} available
                          </p>
                        ) : (
                          <p className="text-sm text-gray-600">No lab results available</p>
                        )}
                      </div>
                      
                      {/* Additional clinical notes */}
                      {visit.history_of_present_illness && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900">History of Present Illness</h4>
                          <p className="text-sm text-gray-700 leading-relaxed">{visit.history_of_present_illness}</p>
                        </div>
                      )}
                      
                      {visit.follow_up_instructions && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900">Follow-up Instructions</h4>
                          <p className="text-sm text-gray-700 leading-relaxed">{visit.follow_up_instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

// AppointmentNode component removed - All appointments are now scheduled visits

const EncounterTimeline: React.FC<EncounterTimelineProps> = ({ 
  visits, 
  appointments = [],
  onAddVisit, 
  onAddVisitTabs,
  onEditVisit, 
  onCreateFollowUp,
  onStartAppointment,
  onVisitStatusChange,
  visitCounts
}) => {
  console.log('🔍 ENCOUNTER TIMELINE: Unified Visit System', {
    totalVisits: visits.length,
    scheduledVisits: visits.filter(v => v.status === 'scheduled').length,
    completedVisits: visits.filter(v => v.status === 'completed').length,
    inProgressVisits: visits.filter(v => v.status === 'in-progress').length,
    hasOnAddVisit: !!onAddVisit,
    hasOnEditVisit: !!onEditVisit
  });
  
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  
  // Sort visits by date and time (includes scheduled visits/appointments)
  const sortedVisits = [...visits].sort((a, b) => {
    // Handle visits that might use scheduled_date instead of visit_date
    const dateA = a.visit_date || a.scheduled_date || '';
    const dateB = b.visit_date || b.scheduled_date || '';
    
    // Skip invalid dates
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    const dateCompare = new Date(dateB).getTime() - new Date(dateA).getTime();
    if (dateCompare !== 0) return dateCompare;
    
    // If same date, sort by time
    const timeA = a.visit_time || a.scheduled_time || '00:00';
    const timeB = b.visit_time || b.scheduled_time || '00:00';
    return timeB.localeCompare(timeA);
  });

  // All items are now visits (appointments are scheduled visits)
  const timelineItems = sortedVisits.map(visit => {
    // Handle scheduled visits that might use scheduled_date instead of visit_date
    const effectiveDate = visit.visit_date || visit.scheduled_date || '';
    const effectiveTime = visit.visit_time || visit.scheduled_time || '00:00';
    
    return {
      ...visit,
      type: 'visit' as const,
      dateTime: effectiveDate ? new Date(`${effectiveDate} ${effectiveTime}`) : new Date(),
      displayDate: effectiveDate,
      displayTime: effectiveTime !== '00:00' ? effectiveTime : undefined
    };
  });

  console.log('📊 UNIFIED TIMELINE:', {
    totalItems: timelineItems.length,
    itemsWithNumbers: timelineItems.filter(item => item.visit_number).length,
    scheduledItems: timelineItems.filter(item => item.status === 'scheduled').length
  });
  
  const toggleVisit = (visitId: string) => {
    setExpandedVisits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(visitId)) {
        newSet.delete(visitId);
      } else {
        newSet.add(visitId);
      }
      return newSet;
    });
  };
  
  return (
    <div className="relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center justify-between">
          {/* Left: Title */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Patient Journey
            </h2>
          </div>
          
          {/* Center: Empty space */}
          <div className="text-center">
            {/* Removed patient info as requested */}
          </div>
          
          {/* Right: Add Visit Buttons */}
          <div className="flex items-center gap-3">
            {onAddVisit && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onAddVisit}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add New Visit
              </motion.button>
            )}
          </div>
        </div>
        
      </motion.div>
      
      {/* Two Column Layout: Timeline (10/12) + Journey Progress (2/12) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Timeline Column - 10/12 width */}
        <div className="col-span-10">
          {console.log('🎬 RENDERING TIMELINE ITEMS:', {
            totalItems: timelineItems.length,
            itemBreakdown: timelineItems.map(item => ({ type: item.type, id: item.id, date: item.displayDate }))
          })}
          {timelineItems.map((item, index) => {
            console.log(`🔄 RENDERING ITEM ${index}:`, { type: item.type, id: item.id, data: item });
            return (
            <div key={`${item.type}-${item.id}`} className="flex items-start gap-6 mb-8 last:mb-0 relative">
              {/* Date column */}
              <div className="w-32 text-right flex-shrink-0 pt-5">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 + 0.1, duration: 0.3 }}
                >
                  <p className={`font-bold text-base leading-tight ${
                    item.type === 'visit' && item.status === 'completed' ? 'text-indigo-600' : 
                    item.type === 'appointment' && isToday(parseISO(item.displayDate)) ? 'text-emerald-600' :
                    'text-gray-900'
                  }`}>
                    {formatVisitDate(item.displayDate)}
                  </p>
                  {item.displayTime && (
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500 font-medium">
                        {item.displayTime}
                      </p>
                    </div>
                  )}
                </motion.div>
              </div>
              
              {/* Timeline content - All items are visits now */}
              <div className="flex-1 min-w-0">
                <TimelineNode
                  visit={item}
                  index={index}
                  totalVisits={timelineItems.length}  // Total count includes scheduled visits
                  isLast={index === timelineItems.length - 1}
                  isExpanded={expandedVisits.has(item.id)}
                  onToggle={() => toggleVisit(item.id)}
                  onEditVisit={onEditVisit}
                  onCreateFollowUp={onCreateFollowUp}
                  onVisitStatusChange={onVisitStatusChange}
                  onStartAppointment={onStartAppointment}
                  visitCounts={visitCounts}
                />
              </div>
            </div>
            );
          })}
        </div>
        
        {/* Journey Progress Column - 2/12 width */}
        <div className="col-span-2">
          <div className="sticky top-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="relative">
                {/* Pure glassmorphic card with border */}
                <div className="relative bg-white/30 backdrop-blur-xl rounded-3xl p-6 overflow-hidden border border-gray-200/50">
                  {/* Gradient overlay for glassmorphic effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 via-white/10 to-indigo-100/30 pointer-events-none" />
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Journey Progress</h3>
                      <p className="text-sm text-gray-700/80">Visit completion status</p>
                    </div>
                    <CompletionDonutChart visits={sortedVisits} />
                  </div>
                  
                  {/* Subtle decorative elements */}
                  <motion.div
                    className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-purple-300/20 to-indigo-300/20 rounded-full blur-3xl"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.div
                    className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br from-indigo-300/20 to-purple-300/20 rounded-full blur-2xl"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 2,
                    }}
                  />
                </div>
              </div>
            </motion.div>
            
            {/* Play Medical History Tile */}
            <div className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                whileHover={{ y: -4 }}
              >
                <div className="relative group cursor-pointer">
                  {/* Premium glassmorphic card */}
                  <div 
                    className="relative bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-3xl p-6 overflow-hidden border border-purple-300/20"
                    onClick={() => {
                      // TODO: Implement medical history playback functionality
                      console.log('Playing medical history for patient...');
                    }}
                  >
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-100/20 via-indigo-100/10 to-purple-100/20 pointer-events-none" />
                    
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Play Medical History</h3>
                      </div>
                      
                      {/* Audio Controls */}
                      <div className="space-y-4">
                        {/* Play/Pause and Control Buttons */}
                        <div className="flex items-center justify-center gap-3">
                          {/* Previous/Restart Button */}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                            </svg>
                          </motion.button>
                          
                          {/* Main Play Button */}
                          <motion.div
                            className="relative"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl group-hover:shadow-purple-500/50 transition-all duration-300">
                              <motion.svg 
                                className="w-5 h-5 text-white ml-1" 
                                fill="currentColor" 
                                viewBox="0 0 24 24"
                                whileHover={{ scale: 1.2 }}
                                transition={{ duration: 0.2 }}
                              >
                                <path d="M8 5v14l11-7z"/>
                              </motion.svg>
                            </div>
                            
                            {/* Ripple effect */}
                            <motion.div
                              className="absolute inset-0 bg-purple-400 rounded-full"
                              animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.3, 0, 0.3]
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeOut"
                              }}
                            />
                          </motion.div>
                          
                          {/* Stop Button */}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 6h12v12H6z"/>
                            </svg>
                          </motion.button>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="px-2">
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <span>0:00</span>
                            <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden cursor-pointer">
                              <motion.div
                                className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full"
                                style={{ width: '0%' }}
                                whileHover={{ opacity: 0.8 }}
                              />
                            </div>
                            <span>2:45</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Subtle decorative elements */}
                    <motion.div
                      className="absolute -top-6 -left-6 w-32 h-32 bg-gradient-to-br from-purple-300/20 to-indigo-300/20 rounded-full blur-3xl"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <motion.div
                      className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-indigo-300/20 to-purple-300/20 rounded-full blur-2xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1.5,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Premium floating decoration */}
      <motion.div
        className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-purple-400 via-indigo-400 to-purple-600 rounded-full blur-3xl opacity-10"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-8 -left-8 w-24 h-24 bg-gradient-to-br from-indigo-400 to-cyan-400 rounded-full blur-2xl opacity-15"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
    </div>
  );
};

export default EncounterTimeline;