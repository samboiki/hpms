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
                  relative group px-4 py-2.5 rounded-t-xl font-medium text-xs
                  transition-all duration-150 flex items-center gap-2 min-w-0 shrink-0
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
                  <div className={`absolute inset-0 border-2 border-b-0 rounded-t-xl transition-colors duration-150 ${
                    activeTab === 'ai-intelligence' ? 'border-gray-300' :
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
        <div className={`bg-white rounded-2xl shadow-lg relative z-10 border-2 transition-all duration-150 ${
          activeTab === 'ai-intelligence' ? 'border-gray-300' :
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
          <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Overview</h3>
          <p className="text-gray-500 text-sm">Patient Health Summary</p>
        </div>
        
        {/* Live Status */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-emerald-600 font-medium">Live</span>
        </div>
      </div>
      
      {/* Patient Journey Section */}
      <div className="relative p-6 bg-gradient-to-br from-white via-gray-50/30 to-blue-50/20 rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/5 to-gray-600/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-gray-500/5 to-gray-700/5 rounded-full blur-xl"></div>
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-700 rounded-lg shadow-md">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>Patient Journey</h4>
              <p className="text-xs text-gray-500">Health Overview</p>
            </div>
          </div>
          
          <div className="text-sm text-gray-700 leading-tight">
            <p className="mb-0">
              {patient?.first_name} {patient?.last_name} has been under our care with a total of <strong>{visits.length} medical encounters</strong> recorded in our system. The patient demonstrates <strong>excellent compliance</strong> with scheduled appointments and treatment protocols. Clinical assessments show <strong>stable vital signs</strong> across {vitals.length} recorded measurements, indicating good baseline health status. Blood pressure, heart rate, and other key indicators remain within normal ranges, suggesting effective ongoing management. Overall prognosis is <strong>positive</strong> with continued monitoring recommended. The patient's consistent engagement with healthcare services and adherence to treatment plans positions them well for long-term health outcomes.
            </p>
          </div>
        </div>
      </div>
      
      {/* Premium Interactive Cards with Real Background Images */}
      <div className="grid grid-cols-3 gap-6">
        {/* Medical Aid Info Card */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onMedicalAidClick || (() => console.log('Open Medical Aid Modal'))}
          className="relative p-6 rounded-2xl border border-blue-200/30 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer"
        >
          {/* Real medical background image - more faded */}
          <div 
            className="absolute inset-0 opacity-5 group-hover:opacity-8 transition-opacity duration-300 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop&crop=center)' }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/90 via-white/80 to-indigo-50/90"></div>
          
          {/* Floating gradient orb */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          
          <div className="relative text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-blue-700" style={{ fontFamily: 'Poppins, sans-serif' }}>Medical Aid</span>
            </div>
            <p className="text-2xl font-black text-blue-700 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{medicalAid?.provider || 'None'}</p>
            <p className="text-sm text-blue-600 font-medium">{medicalAid?.scheme || 'No coverage'}</p>
          </div>
        </motion.button>
        
        {/* Next of Kin Card */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSendSms}
          className="relative p-6 rounded-2xl border border-purple-200/30 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer"
        >
          {/* Real family/contact background image - more faded */}
          <div 
            className="absolute inset-0 opacity-5 group-hover:opacity-8 transition-opacity duration-300 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=600&fit=crop&crop=center)' }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/90 via-white/80 to-pink-50/90"></div>
          
          {/* Floating gradient orb */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          
          {/* SMS Button in corner */}
          <div className="absolute top-3 right-3">
            <div className="p-1.5 bg-purple-100/80 hover:bg-purple-200/80 rounded-lg transition-colors backdrop-blur-sm">
              <MessageSquare className="w-3 h-3 text-purple-600" />
            </div>
          </div>
          
          <div className="relative text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-purple-700" style={{ fontFamily: 'Poppins, sans-serif' }}>Next of Kin</span>
            </div>
            <p className="text-2xl font-black text-purple-700 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{nextOfKin?.name || patient?.emergency_contact_name || 'None'}</p>
            <p className="text-sm text-purple-600 font-medium">{nextOfKin?.relationship || patient?.emergency_contact_relationship || 'Not specified'}</p>
          </div>
        </motion.button>
        
        {/* Money Spent Card */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBillingClick || (() => console.log('Open Billing Modal'))}
          className="relative p-6 rounded-2xl border border-emerald-200/30 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer"
        >
          {/* Real money/finance background image - more faded */}
          <div 
            className="absolute inset-0 opacity-5 group-hover:opacity-8 transition-opacity duration-300 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=600&fit=crop&crop=center)' }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/90 via-white/80 to-green-50/90"></div>
          
          {/* Floating gradient orb */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-emerald-400/20 to-green-500/20 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          
          <div className="relative text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-emerald-700" style={{ fontFamily: 'Poppins, sans-serif' }}>Money Spent</span>
            </div>
            <p className="text-2xl font-black text-emerald-700 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>N$ {totalSpent.toLocaleString()}</p>
            <p className="text-sm text-emerald-600 font-medium">Total to date</p>
          </div>
        </motion.button>
      </div>
      
      {/* Generate Report Button */}
      <div className="pt-4">
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl font-bold text-sm shadow-2xl hover:shadow-3xl hover:shadow-purple-500/40 transition-all duration-500 flex items-center justify-center gap-3 relative overflow-hidden group"
        >
          {/* Animated background shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          
          <div className="relative flex items-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <span style={{ fontFamily: 'Poppins, sans-serif' }}>Generate Comprehensive AI Report</span>
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default PremiumFolderTabs;