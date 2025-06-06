import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Pill,
  Activity,
  FileText,
  TestTube,
  CreditCard,
  Shield,
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
  Filter
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
  onAddVitals 
}) => {
  const [activeTab, setActiveTab] = useState('encounters');
  const [showActionMenu, setShowActionMenu] = useState(false);

  const tabs: TabData[] = [
    {
      id: 'encounters',
      label: 'Encounters',
      icon: <Stethoscope className="w-4 h-4" />,
      count: visits.length,
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'prescriptions',
      label: 'Prescriptions',
      icon: <Pill className="w-4 h-4" />,
      count: 0, // Will be populated when prescriptions are added
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 'vitals',
      label: 'Vitals',
      icon: <Activity className="w-4 h-4" />,
      count: vitals.length,
      color: 'from-red-500 to-rose-600'
    },
    {
      id: 'results',
      label: 'Results',
      icon: <TestTube className="w-4 h-4" />,
      count: 0, // Will be populated when lab results are added
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <FileText className="w-4 h-4" />,
      count: 0, // Will be populated when documents are added
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: <CreditCard className="w-4 h-4" />,
      count: 0, // Will be populated when billing records are added
      color: 'from-teal-500 to-cyan-600'
    },
    {
      id: 'audit',
      label: 'Audit',
      icon: <Shield className="w-4 h-4" />,
      count: 0, // Will be populated when audit logs are added
      color: 'from-slate-500 to-gray-600'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'encounters':
        return <EncountersContent visits={visits} />;
      case 'prescriptions':
        return <PrescriptionsContent />;
      case 'vitals':
        return <VitalsContent vitals={vitals} />;
      case 'results':
        return <ResultsContent />;
      case 'documents':
        return <DocumentsContent />;
      case 'billing':
        return <BillingContent />;
      case 'audit':
        return <AuditContent />;
      default:
        return <EncountersContent visits={visits} />;
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
      <div className="relative mb-8">
        <div className="flex flex-wrap items-end gap-1 relative z-10">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative group px-6 py-4 rounded-t-2xl font-semibold text-sm
                  transition-all duration-300 flex items-center gap-2.5 min-w-0
                  ${isActive 
                    ? 'bg-white shadow-lg -mb-px z-20 text-gray-800 border-x border-t border-gray-200' 
                    : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 hover:text-gray-800 mt-2'
                  }
                `}
                whileHover={{ scale: isActive ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  clipPath: isActive 
                    ? 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% 100%, 0% 100%, 0% 8px)'
                    : 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% 100%, 0% 100%, 0% 6px)'
                }}
              >
                {/* Gradient background for active tab */}
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-5 rounded-t-2xl`} />
                )}
                
                {/* Tab icon with gradient background */}
                <div className={`
                  p-1.5 rounded-lg bg-gradient-to-r ${tab.color} text-white shadow-sm
                  ${isActive ? 'shadow-md' : 'opacity-80'}
                `}>
                  {tab.icon}
                </div>
                
                {/* Tab label */}
                <span className="font-medium truncate">{tab.label}</span>
                
                {/* Count badge */}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-bold
                    ${isActive 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-gray-300 text-gray-600 group-hover:bg-gray-400 group-hover:text-white'
                    }
                  `}>
                    {tab.count}
                  </span>
                )}
                
                {/* Active tab indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${tab.color} rounded-full`}
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        
        {/* Content container with seamless connection to active tab */}
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none shadow-lg relative z-10">
          <div className="p-6">
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
        </div>
      </div>
    </div>
  );
};

// Encounters Content Component
const EncountersContent: React.FC<{ visits: Visit[] }> = ({ visits }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">Medical Encounters</h3>
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
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 hover:shadow-md transition-all duration-200"
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
              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <FileText className="w-3 h-3" />
                View Details
              </button>
              <button className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" />
                Add Notes
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

// Prescriptions Content Component
const PrescriptionsContent: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">Prescriptions</h3>
        <p className="text-gray-500 text-sm">Active and historical medications</p>
      </div>
    </div>
    
    <div className="text-center py-12">
      <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <Pill className="w-8 h-8 text-white" />
      </div>
      <h4 className="text-lg font-semibold text-gray-800 mb-2">No prescriptions recorded</h4>
      <p className="text-gray-500 text-sm">Medication history and prescriptions will appear here</p>
    </div>
  </div>
);

// Vitals Content Component
const VitalsContent: React.FC<{ vitals: Vital[] }> = ({ vitals }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">Vital Signs</h3>
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
                  {format(new Date(vital.recorded_at), 'MMM dd, yyyy HH:mm')}
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
        <h3 className="text-xl font-bold text-gray-800 mb-1">Lab Results & Imaging</h3>
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
        <h3 className="text-xl font-bold text-gray-800 mb-1">Clinical Documents</h3>
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
        <h3 className="text-xl font-bold text-gray-800 mb-1">Billing & Invoices</h3>
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

// Audit Content Component
const AuditContent: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">Audit Trail</h3>
        <p className="text-gray-500 text-sm">Record changes and system activity log</p>
      </div>
    </div>
    
    <div className="text-center py-12">
      <div className="p-4 bg-gradient-to-r from-slate-500 to-gray-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <Shield className="w-8 h-8 text-white" />
      </div>
      <h4 className="text-lg font-semibold text-gray-800 mb-2">No audit records</h4>
      <p className="text-gray-500 text-sm">System changes and modifications will appear here</p>
    </div>
  </div>
);

export default PremiumFolderTabs;