import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
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
  Hexagon
} from 'lucide-react';

interface Visit {
  id: string;
  visit_date: string;
  visit_time?: string;
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  doctor_name?: string;
  visit_type?: string;
  status?: string;
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
}

interface EncounterTimelineProps {
  visits: Visit[];
  patientName?: string;
  onAddVisit?: () => void;
  onEditVisit?: (visit: Visit) => void;
  onCreateFollowUp?: (visit: Visit) => void;
}

// Donut Chart Component
const CompletionDonutChart: React.FC<{ visits: Visit[] }> = ({ visits }) => {
  const completedVisits = visits.filter(visit => visit.status === 'completed').length;
  const totalVisits = visits.length;
  const completionPercentage = totalVisits > 0 ? (completedVisits / totalVisits) * 100 : 0;
  
  const circumference = 2 * Math.PI * 24;
  const strokeDasharray = `${(completionPercentage / 100) * circumference} ${circumference}`;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="60" height="60" className="transform -rotate-90">
          <circle
            cx="30"
            cy="30"
            r="24"
            stroke="currentColor"
            strokeWidth="5"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="30"
            cy="30"
            r="24"
            stroke="currentColor"
            strokeWidth="5"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="text-indigo-600 transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm font-bold text-indigo-600">{Math.round(completionPercentage)}%</div>
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
  const date = parseISO(dateString);
  const day = format(date, 'do');
  const month = format(date, 'MMMM');
  const year = format(date, "''yy");
  return `${day} ${month} ${year}`;
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
}> = ({ visit, index, totalVisits, isLast, isExpanded, onToggle, onEditVisit, onCreateFollowUp }) => {
  const [isHovered, setIsHovered] = useState(false);
  const visitDate = parseISO(visit.visit_date);
  const isTodayVisit = isToday(visitDate);
  const isFutureVisit = isFuture(visitDate);
  const visitNumber = totalVisits - index;
  const isCompleted = visit.status === 'completed';
  
  // Get premium colors and demarcation based on status
  const getVisitTheme = () => {
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
        {/* Connection line */}
        {!isLast && (
          <motion.div
            className="absolute top-16 left-1/2 w-0.5 h-20 bg-gradient-to-b from-gray-300 to-gray-200 -ml-px"
            initial={{ height: 0 }}
            animate={{ height: 80 }}
            transition={{ delay: index * 0.05 + 0.2, duration: 0.4 }}
          />
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
            <div className={`w-10 h-10 ${theme.bg} rounded-full flex items-center justify-center shadow-md`}>
              <span className="text-lg font-bold text-white">
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
            className={`${theme.cardBg} rounded-xl ${
              isHovered ? 'shadow-lg scale-[1.01]' : 'shadow-md'
            } overflow-hidden transition-all duration-200 cursor-pointer relative group`}
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
            
            {/* Card header with wow factors */}
            <div className="p-6 relative z-10">
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
              
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <motion.h3 
                        className={`font-bold text-xl ${theme.textPrimary} relative z-10`}
                        animate={{ scale: isHovered ? 1.05 : 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {getVisitTypeDisplay()}
                      </motion.h3>
                      
                    </div>
                    
                  </div>
                  
                  {visit.chief_complaint && (
                    <motion.p 
                      className={`text-sm mb-4 leading-relaxed ${theme.textSecondary} font-medium relative z-10`}
                      animate={{ opacity: isHovered ? 1 : 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {visit.chief_complaint}
                    </motion.p>
                  )}
                  
                  <div className="flex items-center gap-6 text-xs mb-4">
                    {visit.doctor_name && (
                      <div className="flex items-center gap-3">
                        <motion.div 
                          className="flex items-center gap-2 text-gray-600 bg-white/50 rounded-lg px-3 py-1.5"
                          whileHover={{ scale: 1.05 }}
                        >
                          <User className="w-3 h-3" />
                          <span className="font-semibold">Dr. {visit.doctor_name}</span>
                        </motion.div>
                        
                        {/* Status Indicator below doctor name */}
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className={`px-3 py-1.5 bg-gradient-to-r ${theme.accent} rounded-full shadow-lg backdrop-blur-sm`}>
                            <div className="flex items-center gap-1.5">
                              <motion.div
                                className="w-2 h-2 bg-white rounded-full"
                                animate={{
                                  scale: [1, 1.2, 1],
                                  opacity: [1, 0.7, 1]
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                {theme.status}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced quick stats */}
                  <div className="flex items-center gap-3 relative z-10">
                    {visit.vitals?.blood_pressure && (
                      <motion.div 
                        className="flex items-center gap-2 text-xs bg-gradient-to-r from-red-50 to-pink-50 rounded-xl px-3 py-2 border border-red-100"
                        whileHover={{ scale: 1.05, y: -1 }}
                      >
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="font-bold text-red-700">{visit.vitals.blood_pressure}</span>
                      </motion.div>
                    )}
                    {visit.medications && visit.medications.length > 0 && (
                      <motion.div 
                        className="flex items-center gap-2 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl px-3 py-2 border border-blue-100"
                        whileHover={{ scale: 1.05, y: -1 }}
                      >
                        <Pill className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-blue-700">{visit.medications.length} meds</span>
                      </motion.div>
                    )}
                    {visit.lab_results && visit.lab_results.length > 0 && (
                      <motion.div 
                        className="flex items-center gap-2 text-xs bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl px-3 py-2 border border-emerald-100"
                        whileHover={{ scale: 1.05, y: -1 }}
                      >
                        <FlaskConical className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-emerald-700">{visit.lab_results.length} tests</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action buttons - positioned bottom right */}
              <div className="absolute bottom-4 right-4 flex items-center gap-1 relative z-20">
                {onEditVisit && (
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditVisit(visit);
                    }}
                    className="p-2.5 hover:bg-white/90 rounded-xl transition-all duration-200 group/btn shadow-sm border border-transparent hover:border-purple-200"
                    title="Edit visit"
                  >
                    <Edit3 className="w-4 h-4 text-gray-500 group-hover/btn:text-purple-600 transition-colors" />
                  </motion.button>
                )}
                {onCreateFollowUp && isCompleted && (
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: -5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateFollowUp(visit);
                    }}
                    className="p-2.5 hover:bg-white/90 rounded-xl transition-all duration-200 group/btn shadow-sm border border-transparent hover:border-indigo-200"
                    title="Create follow-up"
                  >
                    <Copy className="w-4 h-4 text-gray-500 group-hover/btn:text-indigo-600 transition-colors" />
                  </motion.button>
                )}
                <motion.div
                  className="p-2.5 hover:bg-white/90 rounded-xl transition-all duration-200 group/btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover/btn:text-purple-600 transition-colors" />
                  </motion.div>
                </motion.div>
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

const EncounterTimeline: React.FC<EncounterTimelineProps> = ({ 
  visits, 
  patientName, 
  onAddVisit, 
  onEditVisit, 
  onCreateFollowUp 
}) => {
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  const sortedVisits = [...visits].sort((a, b) => 
    new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
  );
  
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
          
          {/* Center: Patient Info */}
          <div className="text-center">
            {patientName && (
              <p className="text-gray-700 font-medium">
                {patientName} • <span className="text-purple-600 font-semibold">{sortedVisits.length}</span> visits
              </p>
            )}
          </div>
          
          {/* Right: Add Visit Button */}
          <div>
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
      
      {/* Timeline */}
      <div className="space-y-8">
        {sortedVisits.map((visit, index) => (
          <div key={visit.id} className="flex items-start gap-6">
            {/* Date column */}
            <div className="w-32 text-right flex-shrink-0">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 + 0.1, duration: 0.3 }}
              >
                <p className="font-bold text-gray-900 text-sm leading-tight">
                  {formatVisitDate(visit.visit_date)}
                </p>
                {visit.visit_time && (
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500 font-medium">
                      {visit.visit_time}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
            
            {/* Timeline content */}
            <div className="flex-1">
              <TimelineNode
                visit={visit}
                index={index}
                totalVisits={sortedVisits.length}
                isLast={index === sortedVisits.length - 1}
                isExpanded={expandedVisits.has(visit.id)}
                onToggle={() => toggleVisit(visit.id)}
                onEditVisit={onEditVisit}
                onCreateFollowUp={onCreateFollowUp}
              />
            </div>
            
            {/* Progress Chart column */}
            <div className="w-48 flex-shrink-0">
              {index === 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-center mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">Journey Progress</h3>
                      <p className="text-xs text-gray-500">Visit completion status</p>
                    </div>
                    <CompletionDonutChart visits={sortedVisits} />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        ))}
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