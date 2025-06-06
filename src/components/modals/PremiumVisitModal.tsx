import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Stethoscope,
  Calendar,
  Clock,
  User,
  FileText,
  Activity,
  TestTube,
  ImageIcon,
  Pill,
  AlertCircle,
  Heart,
  Thermometer,
  Weight,
  ChevronRight,
  Edit3,
  Download,
  Share,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

interface Visit {
  id: string;
  visit_date: string;
  visit_time?: string;
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  status?: string;
  doctor_id?: string;
  history_of_present_illness?: string;
  follow_up_instructions?: string;
  vitals?: any;
  lab_results?: any[];
  media?: any[];
}

interface PremiumVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: Visit | null;
  onEdit?: () => void;
  onStatusChange?: (status: string) => void;
}

const PremiumVisitModal: React.FC<PremiumVisitModalProps> = ({
  isOpen,
  onClose,
  visit,
  onEdit,
  onStatusChange
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !visit) return null;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <Stethoscope className="w-4 h-4" />,
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'vitals',
      label: 'Vitals',
      icon: <Activity className="w-4 h-4" />,
      color: 'from-red-500 to-rose-600'
    },
    {
      id: 'results',
      label: 'Results',
      icon: <TestTube className="w-4 h-4" />,
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'media',
      label: 'Imaging',
      icon: <ImageIcon className="w-4 h-4" />,
      color: 'from-emerald-500 to-green-600'
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: <FileText className="w-4 h-4" />,
      color: 'from-amber-500 to-orange-600'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Chief Complaint</h4>
                  <p className="text-gray-700">{visit.chief_complaint || 'No complaint recorded'}</p>
                </div>
                
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                  <h4 className="text-sm font-bold text-emerald-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Diagnosis</h4>
                  <p className="text-gray-700">{visit.diagnosis || 'No diagnosis recorded'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                  <h4 className="text-sm font-bold text-purple-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Treatment Plan</h4>
                  <p className="text-gray-700">{visit.treatment_plan || 'No treatment plan recorded'}</p>
                </div>
                
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                  <h4 className="text-sm font-bold text-amber-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Follow-up Instructions</h4>
                  <p className="text-gray-700">{visit.follow_up_instructions || 'No follow-up instructions'}</p>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'vitals':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="p-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Vital Signs</h4>
              <p className="text-gray-500 text-sm">Recorded during this visit</p>
            </div>
            
            {visit.vitals ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <div className="text-lg font-bold text-gray-800">{visit.vitals.blood_pressure || 'N/A'}</div>
                  <div className="text-xs text-gray-500">Blood Pressure</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <Activity className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-lg font-bold text-gray-800">{visit.vitals.pulse_rate || 'N/A'}</div>
                  <div className="text-xs text-gray-500">Pulse Rate</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-xl">
                  <Thermometer className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <div className="text-lg font-bold text-gray-800">{visit.vitals.temperature || 'N/A'}°C</div>
                  <div className="text-xs text-gray-500">Temperature</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <Weight className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <div className="text-lg font-bold text-gray-800">{visit.vitals.weight || 'N/A'}kg</div>
                  <div className="text-xs text-gray-500">Weight</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No vital signs recorded for this visit</p>
              </div>
            )}
          </div>
        );
        
      case 'results':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="p-4 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <TestTube className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Lab Results</h4>
              <p className="text-gray-500 text-sm">Test results and analysis</p>
            </div>
            
            {visit.lab_results && visit.lab_results.length > 0 ? (
              <div className="space-y-3">
                {visit.lab_results.map((result, index) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-800">{result.name}</h5>
                        <p className="text-sm text-gray-600">{result.value} {result.unit}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        result.status === 'normal' ? 'bg-green-100 text-green-700' :
                        result.status === 'high' ? 'bg-red-100 text-red-700' :
                        result.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {result.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No lab results recorded for this visit</p>
              </div>
            )}
          </div>
        );
        
      case 'media':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="p-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Medical Imaging</h4>
              <p className="text-gray-500 text-sm">X-rays, scans, and photos</p>
            </div>
            
            {visit.media && visit.media.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {visit.media.map((item, index) => (
                  <div key={index} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h5 className="font-semibold text-gray-800 mb-1">{item.type}</h5>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No medical imaging recorded for this visit</p>
              </div>
            )}
          </div>
        );
        
      case 'notes':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Clinical Notes</h4>
              <p className="text-gray-500 text-sm">Additional observations and notes</p>
            </div>
            
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <h5 className="font-semibold text-amber-800 mb-2">History of Present Illness</h5>
              <p className="text-gray-700">{visit.history_of_present_illness || 'No history recorded'}</p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-[#01b9d5] to-purple-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-purple-600/20 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>Visit Details</h2>
                <p className="text-blue-100 text-sm">
                  {format(new Date(visit.visit_date), 'MMMM dd, yyyy')} • {visit.visit_time}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                visit.status === 'completed' ? 'bg-green-500/20 text-green-100' :
                visit.status === 'in-progress' ? 'bg-blue-500/20 text-blue-100' :
                'bg-gray-500/20 text-gray-100'
              }`}>
                {visit.status}
              </span>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2 mb-6 overflow-x-auto">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab.icon}
                <span className="text-sm font-medium">{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {visit.status === 'in-progress' && onStatusChange && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onStatusChange('completed')}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 font-medium text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Complete Visit
                </motion.button>
              )}
              
              {onEdit && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onEdit}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl flex items-center gap-2 hover:bg-gray-200 transition-all font-medium text-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Visit
                </motion.button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-blue-100 text-blue-700 rounded-xl flex items-center gap-2 hover:bg-blue-200 transition-all font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-purple-100 text-purple-700 rounded-xl flex items-center gap-2 hover:bg-purple-200 transition-all font-medium text-sm"
              >
                <Share className="w-4 h-4" />
                Share
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PremiumVisitModal;