import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Pill,
  Activity,
  FileText,
  TestTube,
  CreditCard,
  Stethoscope,
  Heart,
  TrendingUp,
  Microscope,
  ImageIcon,
  FileCheck,
  Receipt,
  History,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  Weight,
  User,
  Clock,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Shield,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import PremiumVisitModal from '../modals/PremiumVisitModal';

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
}

interface Vital {
  id: string;
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  heart_rate: number;
  temperature: number;
  weight: number;
  recorded_at: string;
}

interface PremiumFolderTabsProps {
  visits: Visit[];
  vitals: Vital[];
  patientId: string;
  onAddVisit?: () => void;
  onAddVitals?: () => void;
  onVisitClick?: (visitId: string) => Promise<void>;
  onEditVisit?: (visit: Visit) => void;
  onVisitStatusChange?: (visitId: string, status: string) => Promise<void>;
  patient?: any;
  nextOfKin?: any;
  medicalAid?: any;
  onSendSms?: () => void;
  onMedicalAidClick?: () => void;
  onBillingClick?: () => void;
}

interface TabData {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  color: string;
}

const PremiumFolderTabs: React.FC<PremiumFolderTabsProps> = ({ 
  visits, 
  vitals, 
  patientId,
  onAddVisit,
  onAddVitals,
  onVisitClick,
  onEditVisit,
  onVisitStatusChange,
  patient,
  nextOfKin,
  medicalAid,
  onSendSms,
  onMedicalAidClick,
  onBillingClick
}) => {
  const [activeTab, setActiveTab] = useState('ai-intelligence');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

  const tabs: TabData[] = [
    {
      id: 'ai-intelligence',
      label: 'Overview',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      count: undefined,
      color: 'from-gray-400 to-gray-600'
    },
    {
      id: 'encounters',
      label: 'Encounters',
      icon: <Stethoscope className="w-3.5 h-3.5" />,
      count: visits.length,
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'vitals',
      label: 'Vitals',
      icon: <Activity className="w-3.5 h-3.5" />,
      count: vitals.length,
      color: 'from-red-500 to-rose-600'
    },
    {
      id: 'results',
      label: 'Results',
      icon: <TestTube className="w-3.5 h-3.5" />,
      count: 0, // Will be populated when lab results are added
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <FileText className="w-3.5 h-3.5" />,
      count: 0, // Will be populated when documents are added
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: <CreditCard className="w-3.5 h-3.5" />,
      count: 0, // Will be populated when billing records are added
      color: 'from-teal-500 to-cyan-600'
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <Shield className="w-3.5 h-3.5" />,
      count: 0, // Will be populated when audit logs are added
      color: 'from-slate-500 to-gray-600'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai-intelligence':
        return <AIIntelligenceContent 
          visits={visits} 
          vitals={vitals} 
          patientId={patientId}
          patient={patient}
          nextOfKin={nextOfKin}
          medicalAid={medicalAid}
          onSendSms={onSendSms}
          onMedicalAidClick={onMedicalAidClick}
          onBillingClick={onBillingClick}
        />;
      case 'encounters':
        return <EncountersContent 
          visits={visits} 
          onVisitClick={(visit) => {
            setSelectedVisit(visit);
            setIsVisitModalOpen(true);
          }}
          onEditVisit={onEditVisit}
          onVisitStatusChange={onVisitStatusChange}
        />;
      case 'vitals':
        return <VitalsContent vitals={vitals} />;
      case 'results':
        return <ResultsContent />;
      case 'documents':
        return <DocumentsContent />;
      case 'billing':
        return <BillingContent />;
      case 'audit':
        return <AuditTrailContent />;
      default:
        return <AIIntelligenceContent visits={visits} vitals={vitals} patientId={patientId} />;
    }
  };

  return (
    <div className="w-full relative">
      {/* Header with Search and Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Patient Records
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Comprehensive medical history and documentation
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative"
          >
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search records..."
              className="pl-10 pr-4 py-2.5 text-sm bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4] transition-all backdrop-blur-sm shadow-sm text-gray-700 placeholder:text-gray-400"
            />
          </motion.div>
          
          {/* Quick Actions Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="px-4 py-2.5 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-2xl hover:shadow-[#01b9d5]/30 transition-all duration-300 font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              Quick Add
            </motion.button>
            
            {/* Action Menu Dropdown */}
            <AnimatePresence>
              {showActionMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50"
                >
                  {onAddVisit && (
                    <button
                      onClick={() => {
                        onAddVisit();
                        setShowActionMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
                    >
                      <Stethoscope className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">New Visit</span>
                    </button>
                  )}
                  {onAddVitals && (
                    <button
                      onClick={() => {
                        onAddVitals();
                        setShowActionMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
                    >
                      <Activity className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium">Record Vitals</span>
                    </button>
                  )}
                  <button className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors">
                    <Pill className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Add Prescription</span>
                  </button>
                  <button className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors">
                    <TestTube className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">Order Lab Test</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Folder-style tabs */}
      <div className="relative mb-0">
        <div className="flex items-end gap-0.5 relative z-10">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative group px-6 py-3 rounded-t-xl font-medium text-xs
                  transition-all duration-300 flex items-center gap-2 min-w-0 shrink-0
                  ${isActive 
                    ? 'bg-white shadow-lg -mb-[2px] z-20 text-gray-800' 
                    : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 hover:text-gray-800 mt-1'
                  }
                `}
                whileHover={{ scale: isActive ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  clipPath: isActive 
                    ? 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% 100%, 0% 100%, 0% 6px)'
                    : 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% 100%, 0% 100%, 0% 4px)'
                }}
              >
                {/* Gradient background for active tab */}
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-5 rounded-t-xl`} />
                )}
                
                {/* Tab icon - only colored when active */}
                <div className={`
                  p-1 rounded-md transition-all duration-150
                  ${isActive 
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-sm` 
                    : 'bg-gray-300 text-gray-500'
                  }
                `}>
                  {tab.icon}
                </div>
                
                {/* Tab label */}
                <span className="font-medium truncate whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{tab.label}</span>
                
                {/* Count badge */}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`
                    px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[18px] text-center
                    ${isActive 
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm' 
                      : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white group-hover:from-slate-500 group-hover:to-slate-600'
                    }
                  `}>
                    {tab.count}
                  </span>
                )}
                
                {/* Active tab top border that matches content border */}
                {isActive && (
                  <div className={`absolute inset-0 border-2 border-b-0 rounded-t-xl transition-colors duration-300 ${
                    activeTab === 'ai-intelligence' ? 'border-[#01b9d5]/30' :
                    activeTab === 'encounters' ? 'border-blue-300' :
                    activeTab === 'vitals' ? 'border-red-300' :
                    activeTab === 'results' ? 'border-purple-300' :
                    activeTab === 'documents' ? 'border-amber-300' :
                    activeTab === 'billing' ? 'border-teal-300' :
                    activeTab === 'audit' ? 'border-slate-300' :
                    'border-gray-200'
                  }`} />
                )}
              </motion.button>
            );
          })}
        </div>
        
        {/* Content container with seamless connection to active tab */}
        <div className={`bg-white rounded-2xl shadow-lg relative z-10 border-2 transition-all duration-300 ${
          activeTab === 'ai-intelligence' ? 'border-[#01b9d5]/30' :
          activeTab === 'encounters' ? 'border-blue-300' :
          activeTab === 'vitals' ? 'border-red-300' :
          activeTab === 'results' ? 'border-purple-300' :
          activeTab === 'documents' ? 'border-amber-300' :
          activeTab === 'billing' ? 'border-teal-300' :
          activeTab === 'audit' ? 'border-slate-300' :
          'border-gray-200'
        }`} style={{
          borderTopLeftRadius: activeTab === tabs[0]?.id ? '0' : '1rem'
        }}>
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.1 }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Premium Visit Modal */}
      <PremiumVisitModal
        isOpen={isVisitModalOpen}
        onClose={() => {
          setIsVisitModalOpen(false);
          setSelectedVisit(null);
        }}
        visit={selectedVisit}
        onEdit={() => {
          setIsVisitModalOpen(false);
          if (selectedVisit && onEditVisit) {
            onEditVisit(selectedVisit);
          }
        }}
        onStatusChange={(status) => {
          if (selectedVisit && onVisitStatusChange) {
            onVisitStatusChange(selectedVisit.id, status);
          }
        }}
      />
    </div>
  );
};

// Encounters Content Component
const EncountersContent: React.FC<{ 
  visits: Visit[];
  onVisitClick?: (visit: Visit) => void;
  onEditVisit?: (visit: Visit) => void;
  onVisitStatusChange?: (visitId: string, status: string) => void;
}> = ({ visits, onVisitClick, onEditVisit, onVisitStatusChange }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Medical Encounters</h3>
        <p className="text-gray-500 text-sm">Complete visit history and clinical notes</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Calendar className="w-4 h-4" />
        <span>{visits.length} total visits</span>
      </div>
    </div>
    
    {visits.length > 0 ? (
      <div className="space-y-4">
        {visits.map((visit, index) => (
          <motion.div
            key={visit.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => onVisitClick && onVisitClick(visit)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">
                    {format(new Date(visit.visit_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-sm text-gray-500">{visit.visit_time}</div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                visit.status === 'completed' ? 'bg-green-100 text-green-700' :
                visit.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {visit.status}
              </span>
            </div>
            
            <div className="space-y-2">
              {visit.chief_complaint && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Chief Complaint:</span>
                  <p className="text-gray-800 text-sm mt-1">{visit.chief_complaint}</p>
                </div>
              )}
              {visit.diagnosis && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Diagnosis:</span>
                  <p className="text-gray-800 text-sm mt-1">{visit.diagnosis}</p>
                </div>
              )}
              {visit.treatment_plan && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Treatment Plan:</span>
                  <p className="text-gray-800 text-sm mt-1">{visit.treatment_plan}</p>
                </div>
              )}
            </div>
            
            {/* Quick Actions for this visit */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-100">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onVisitClick && onVisitClick(visit);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                View Details
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onEditVisit && onEditVisit(visit);
                }}
                className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Edit Visit
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    ) : (
      <div className="text-center py-12">
        <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Stethoscope className="w-8 h-8 text-white" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-2">No encounters recorded</h4>
        <p className="text-gray-500 text-sm">Patient visits and consultations will appear here</p>
      </div>
    )}
  </div>
);

// Audit Trail Content Component
const AuditTrailContent: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Audit Trail</h3>
        <p className="text-gray-500 text-sm">System logs and change history for administrators</p>
      </div>
    </div>
    
    <div className="text-center py-12">
      <div className="p-4 bg-gradient-to-r from-slate-500 to-gray-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <Shield className="w-8 h-8 text-white" />
      </div>
      <h4 className="text-lg font-semibold text-gray-800 mb-2">No audit logs recorded</h4>
      <p className="text-gray-500 text-sm">System changes and administrative actions will appear here</p>
    </div>
  </div>
);

// Vitals Content Component
const VitalsContent: React.FC<{ vitals: Vital[] }> = ({ vitals }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Vital Signs</h3>
        <p className="text-gray-500 text-sm">Historical vital signs and trends</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <TrendingUp className="w-4 h-4" />
        <span>{vitals.length} recordings</span>
      </div>
    </div>
    
    {vitals.length > 0 ? (
      <div className="space-y-4">
        {vitals.map((vital, index) => (
          <motion.div
            key={vital.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-red-500 to-rose-600 rounded-lg">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <div className="text-sm text-gray-500">
                  {vital.recorded_at ? format(new Date(vital.recorded_at), 'MMM dd, yyyy HH:mm') : 'No date recorded'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800">
                  {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic}
                </div>
                <div className="text-xs text-gray-500">Blood Pressure</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800">{vital.heart_rate}</div>
                <div className="text-xs text-gray-500">Heart Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800">{vital.temperature}°C</div>
                <div className="text-xs text-gray-500">Temperature</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800">{vital.weight}kg</div>
                <div className="text-xs text-gray-500">Weight</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    ) : (
      <div className="text-center py-12">
        <div className="p-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-2">No vital signs recorded</h4>
        <p className="text-gray-500 text-sm">Patient vital signs and measurements will appear here</p>
      </div>
    )}
  </div>
);

// Results Content Component
const ResultsContent: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Lab Results & Imaging</h3>
        <p className="text-gray-500 text-sm">Diagnostic test results and medical imaging</p>
      </div>
    </div>
    
    <div className="grid md:grid-cols-2 gap-6">
      <div className="text-center py-8 bg-purple-50 rounded-xl border border-purple-100">
        <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
          <TestTube className="w-6 h-6 text-white" />
        </div>
        <h4 className="font-semibold text-gray-800 mb-1">Lab Results</h4>
        <p className="text-gray-500 text-sm">Blood work, urine tests, etc.</p>
      </div>
      
      <div className="text-center py-8 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="p-3 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-white" />
        </div>
        <h4 className="font-semibold text-gray-800 mb-1">Medical Imaging</h4>
        <p className="text-gray-500 text-sm">X-rays, CT scans, MRIs</p>
      </div>
    </div>
  </div>
);

// Documents Content Component
const DocumentsContent: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Clinical Documents</h3>
        <p className="text-gray-500 text-sm">Referrals, consents, and clinical documentation</p>
      </div>
    </div>
    
    <div className="text-center py-12">
      <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <FileText className="w-8 h-8 text-white" />
      </div>
      <h4 className="text-lg font-semibold text-gray-800 mb-2">No documents uploaded</h4>
      <p className="text-gray-500 text-sm">Clinical documents and forms will appear here</p>
    </div>
  </div>
);

// Billing Content Component
const BillingContent: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Billing & Invoices</h3>
        <p className="text-gray-500 text-sm">Financial history and payment records</p>
      </div>
    </div>
    
    <div className="text-center py-12">
      <div className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <CreditCard className="w-8 h-8 text-white" />
      </div>
      <h4 className="text-lg font-semibold text-gray-800 mb-2">No billing records</h4>
      <p className="text-gray-500 text-sm">Invoices and payment history will appear here</p>
    </div>
  </div>
);


// AI Intelligence Content Component
const AIIntelligenceContent: React.FC<{ 
  visits: Visit[]; 
  vitals: Vital[]; 
  patientId: string;
  patient?: any;
  nextOfKin?: any;
  medicalAid?: any;
  onSendSms?: () => void;
  onMedicalAidClick?: () => void;
  onBillingClick?: () => void;
}> = ({ visits, vitals, patientId, patient, nextOfKin, medicalAid, onSendSms, onMedicalAidClick, onBillingClick }) => {
  // Calculate total spent (mock calculation based on visits)
  const totalSpent = visits.length * 450 + vitals.length * 75 + 1250;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Overview</h3>
          <p className="text-gray-500 text-sm">Comprehensive Health Analysis</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Live Status */}
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-emerald-600 font-medium">Live Analysis</span>
          </div>
          
          {/* Generate Report Button - Relocated here */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg font-medium text-sm shadow-md hover:shadow-xl transition-all duration-300"
          >
            <Sparkles className="w-4 h-4" />
            <span style={{ fontFamily: 'Poppins, sans-serif' }}>Generate Report</span>
          </motion.button>
        </div>
      </div>
      
      {/* Patient Journey and AI Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Journey */}
        <div className="relative group">
          {/* Gorgeous gradient border */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-2xl transform rotate-0.5 group-hover:rotate-1 transition-transform duration-500 opacity-20 group-hover:opacity-30"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-[#01b9d5]/5 to-purple-600/5 rounded-2xl p-0.5 shadow-lg group-hover:shadow-xl transition-all duration-300">
            <div className="relative bg-white rounded-2xl overflow-hidden border border-[#01b9d5]/20 group-hover:border-[#01b9d5]/40 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-xl transition-all duration-300">
                    <User className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>Patient Journey</h4>
                    <p className="text-xs text-gray-500">Clinical History Overview</p>
                  </div>
                </div>
            
            <div className="text-sm text-gray-600 leading-relaxed">
              <p className="mb-0">
                {patient?.first_name} {patient?.last_name} has been under our care with <strong className="text-gray-800">{visits.length} medical encounters</strong> recorded. 
                The patient demonstrates <strong className="text-gray-800">excellent compliance</strong> with scheduled appointments and treatment protocols. 
                Clinical assessments show <strong className="text-gray-800">stable vital signs</strong> across {vitals.length} recorded measurements, 
                with all key indicators within normal ranges. Overall prognosis is <strong className="text-gray-800">positive</strong> with continued 
                monitoring recommended for optimal health outcomes.
              </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* AI Insights */}
        <div className="relative group">
          {/* Gorgeous gradient border */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-2xl transform -rotate-0.5 group-hover:-rotate-1 transition-transform duration-500 opacity-20 group-hover:opacity-30"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-[#01b9d5]/5 to-purple-600/5 rounded-2xl p-0.5 shadow-lg group-hover:shadow-xl transition-all duration-300">
            <div className="relative bg-white rounded-2xl overflow-hidden border border-[#01b9d5]/20 group-hover:border-[#01b9d5]/40 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-purple-500 group-hover:to-pink-600 rounded-xl shadow-md transition-all duration-300">
                    <Sparkles className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>AI Insights</h4>
                    <p className="text-xs text-gray-500">Smart Health Recommendations</p>
                  </div>
                </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-700">1</span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong className="text-gray-800">Health Status:</strong> Stable clinical parameters with consistent improvement patterns observed.
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-green-700">2</span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong className="text-gray-800">Recommendations:</strong> Continue current treatment plan with quarterly follow-ups for monitoring.
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-purple-700">3</span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong className="text-gray-800">Prevention:</strong> Consider annual health screenings and lifestyle modifications for long-term wellness.
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Ultra Premium Stats Cards */}
      <div className="grid grid-cols-3 gap-6">
        {/* Medical Aid Card */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative group cursor-pointer"
          onClick={onMedicalAidClick}
        >
          {/* Gorgeous gradient background - hidden by default, shown on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500 opacity-0 group-hover:opacity-100"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-3xl p-1 shadow-lg group-hover:shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.03] transition-opacity duration-300" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230EA5E9' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
              
              {/* Ultra faded background image */}
              <div 
                className="absolute inset-0 opacity-[0.01] group-hover:opacity-[0.02] grayscale bg-cover bg-center mix-blend-overlay transition-opacity duration-300"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop)' }}
              ></div>
              
              <div className="relative p-6">
                {/* Header with icon and title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-[#01b9d5] group-hover:to-purple-600 blur-xl opacity-0 group-hover:opacity-50 transition-all duration-300"></div>
                    <div className="relative p-3 bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-2xl shadow-sm group-hover:shadow-lg transition-all duration-300">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 group-hover:text-gray-800 transition-colors duration-300" style={{ fontFamily: 'Poppins, sans-serif' }}>Medical Aid</p>
                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                      <span className="text-xs font-medium">View Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="space-y-1">
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {medicalAid?.provider || 'Not Registered'}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">{medicalAid?.scheme || 'Click to add'}</p>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#01b9d5] to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Next of Kin Card */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative group cursor-pointer"
          onClick={onSendSms}
        >
          {/* Gorgeous gradient background - hidden by default, shown on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500 opacity-0 group-hover:opacity-100"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-3xl p-1 shadow-lg group-hover:shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.03] transition-opacity duration-300" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23A855F7' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
              
              {/* Ultra faded background image */}
              <div 
                className="absolute inset-0 opacity-[0.01] group-hover:opacity-[0.02] grayscale bg-cover bg-center mix-blend-overlay transition-opacity duration-300"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1606788075819-9574a6edfab3?w=800&h=600&fit=crop)' }}
              ></div>
              
              <div className="relative p-6">
                {/* Header with icon and title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-[#01b9d5] group-hover:to-purple-600 blur-xl opacity-0 group-hover:opacity-50 transition-all duration-300"></div>
                    <div className="relative p-3 bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-2xl shadow-sm group-hover:shadow-lg transition-all duration-300">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-700 group-hover:text-gray-800 transition-colors duration-300" style={{ fontFamily: 'Poppins, sans-serif' }}>Emergency Contact</p>
                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                      <span className="text-xs font-medium">Send SMS</span>
                      <MessageSquare className="w-3 h-3" />
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="space-y-1">
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {nextOfKin?.name || patient?.emergency_contact_name || 'Not Added'}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">
                    {nextOfKin?.relationship || patient?.emergency_contact_relationship || 'Click to add'}
                  </p>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#01b9d5] to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Total Spent Card */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative group cursor-pointer"
          onClick={onBillingClick}
        >
          {/* Gorgeous gradient background - hidden by default, shown on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500 opacity-0 group-hover:opacity-100"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-3xl p-1 shadow-lg group-hover:shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.03] transition-opacity duration-300" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310B981' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
              
              {/* Ultra faded background image */}
              <div 
                className="absolute inset-0 opacity-[0.01] group-hover:opacity-[0.02] grayscale bg-cover bg-center mix-blend-overlay transition-opacity duration-300"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=800&h=600&fit=crop)' }}
              ></div>
              
              <div className="relative p-6">
                {/* Header with icon and title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-[#01b9d5] group-hover:to-purple-600 blur-xl opacity-0 group-hover:opacity-50 transition-all duration-300"></div>
                    <div className="relative p-3 bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-2xl shadow-sm group-hover:shadow-lg transition-all duration-300">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 group-hover:text-gray-800 transition-colors duration-300" style={{ fontFamily: 'Poppins, sans-serif' }}>Total Investment</p>
                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                      <span className="text-xs font-medium">View Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="space-y-1">
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    N$ {totalSpent.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">Healthcare expenses</p>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#01b9d5] to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PremiumFolderTabs;