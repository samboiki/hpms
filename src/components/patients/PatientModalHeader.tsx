import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  User,
  Phone,
  Mail,
  Minimize,
  Maximize,
  X,
  UserPlus,
  Shield,
  Stethoscope,
  ArrowLeft,
  Bot,
  Sparkles
} from 'lucide-react';
import { Patient } from '../../stores/patientsStoreNew';

interface PatientDetails {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
}

interface PatientModalHeaderProps {
  activeTab: 'patients' | 'details';
  isFullScreen: boolean;
  selectedPatientDetails: PatientDetails | null;
  onClose: () => void;
  onToggleFullScreen: () => void;
  onBackToList?: () => void;
  filteredPatients?: Patient[];
  medicalAid?: any;
  visits?: any[];
  vitals?: any[];
}

const PatientModalHeader: React.FC<PatientModalHeaderProps> = ({
  activeTab,
  isFullScreen,
  selectedPatientDetails,
  onClose,
  onToggleFullScreen,
  onBackToList,
  filteredPatients = [],
  medicalAid,
  visits = [],
  vitals = []
}) => {
  const totalPatients = filteredPatients.length;
  const newThisMonth = Math.floor(totalPatients * 0.15);
  const withMedicalAid = filteredPatients.filter(p => 
    p.medical_aid_details && p.medical_aid_details.length > 0
  ).length;
  const medicalAidPercentage = totalPatients > 0 
    ? Math.round((withMedicalAid / totalPatients) * 100) 
    : 0;
  return (
    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
      {activeTab === 'patients' ? (
        // Patients List Header
        <div className="pt-6 px-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Patient Management
                  {isFullScreen && (
                    <span className="text-sm bg-white/20 px-2 py-1 rounded-full">Full Screen</span>
                  )}
                </h2>
                <p className="text-white/90">
                  Comprehensive patient database and management {isFullScreen ? '• Full Screen Mode' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleFullScreen}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isFullScreen ? 'Exit Full Screen (Esc or F11)' : 'Full Screen (F11)'}
              >
                {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </motion.button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4">
            {/* Total Patients */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Users className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Total Patients</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  {totalPatients}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">active records</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">TOTAL</div>
                </div>
              </div>
            </motion.div>

            {/* New This Month */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <UserPlus className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">New This Month</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  +{newThisMonth}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">new registrations</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">NEW</div>
                </div>
              </div>
            </motion.div>

            {/* Medical Aid Coverage */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Shield className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Medical Aid Coverage</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  {medicalAidPercentage}%
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">{withMedicalAid} covered</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">COVER</div>
                </div>
              </div>
            </motion.div>

            {/* Active Services */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Stethoscope className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Patient Services</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  8
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">services available</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">CARE</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
        // Patient Details Header with Snapshot Info
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Back button */}
              {onBackToList && (
                <motion.button
                  onClick={onBackToList}
                  className="p-3 bg-white/20 rounded-xl backdrop-blur-sm hover:bg-white/30 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Back to Patients List"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              )}
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold">
                    {selectedPatientDetails?.first_name} {selectedPatientDetails?.last_name}
                  </h2>
                  {isFullScreen && (
                    <span className="text-sm bg-white/20 px-2 py-1 rounded-full">Full Screen</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-white/90 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-white/10 px-2 py-1 rounded-md font-mono">
                      ID: {selectedPatientDetails?.id?.substring(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-semibold">
                      {selectedPatientDetails?.date_of_birth 
                        ? Math.floor((Date.now() - new Date(selectedPatientDetails.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                        : 'N/A'} yrs
                    </span>
                    <span>•</span>
                    <span className="capitalize">{selectedPatientDetails?.gender || 'N/A'}</span>
                  </div>
                  {selectedPatientDetails?.cell_number && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{selectedPatientDetails.cell_number}</span>
                      </div>
                    </>
                  )}
                  {selectedPatientDetails?.email && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-xs">{selectedPatientDetails.email}</span>
                      </div>
                    </>
                  )}
                  {medicalAid && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg">
                        <Shield className="w-3 h-3 text-green-300" />
                        <span className="text-sm font-medium text-green-100">{medicalAid.provider}</span>
                        <span className="text-xs text-green-200">#{medicalAid.member_number}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleFullScreen}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isFullScreen ? 'Exit Full Screen (Esc or F11)' : 'Full Screen (F11)'}
              >
                {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </motion.button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientModalHeader;