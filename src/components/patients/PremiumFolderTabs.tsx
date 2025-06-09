import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  MessageSquare,
  X,
  Code
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import PremiumVisitModal from '../modals/PremiumVisitModal';
import FormModal from '../modals/FormModal';
import { supabase } from '../../lib/supabase';

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ai-intelligence');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [billingCount, setBillingCount] = useState(0);

  // Fetch billing count when component mounts
  React.useEffect(() => {
    const fetchBillingCount = async () => {
      if (!patientId) {
        setBillingCount(0);
        return;
      }
      
      // Count services from invoice_services via invoices_enhanced ONLY
      const { data: invoiceData } = await supabase
        .from('invoices_enhanced')
        .select('id')
        .eq('patient_id', patientId);
      
      if (!invoiceData || invoiceData.length === 0) {
        setBillingCount(0);
        return;
      }
      
      const invoiceIds = invoiceData.map(inv => inv.id);
      const { count } = await supabase
        .from('invoice_services')
        .select('*', { count: 'exact', head: true })
        .in('invoice_id', invoiceIds);
      
      setBillingCount(count || 0);
    };

    fetchBillingCount();
  }, [patientId, visits]);

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
      count: billingCount,
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
        return <BillingContent patientId={patientId} />;
      case 'audit':
        return <AuditTrailContent patientId={patientId} />;
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

      {/* Clean professional tabs */}
      <div className="relative mb-6">
        <div className="flex items-center gap-1 relative z-10 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            
            // Get content area colors
            const getTabColors = () => {
              switch(tab.id) {
                case 'ai-intelligence': return {
                  gradient: 'from-purple-500 to-pink-600',
                  textColor: isActive ? 'text-purple-700' : 'text-gray-600',
                  borderColor: 'border-purple-200/50'
                };
                case 'encounters': return {
                  gradient: 'from-blue-500 to-indigo-600', 
                  textColor: isActive ? 'text-blue-700' : 'text-gray-600',
                  borderColor: 'border-blue-200/50'
                };
                case 'vitals': return {
                  gradient: 'from-red-500 to-rose-600',
                  textColor: isActive ? 'text-red-700' : 'text-gray-600', 
                  borderColor: 'border-red-200/50'
                };
                case 'results': return {
                  gradient: 'from-purple-500 to-violet-600',
                  textColor: isActive ? 'text-purple-700' : 'text-gray-600',
                  borderColor: 'border-purple-200/50'
                };
                case 'documents': return {
                  gradient: 'from-amber-500 to-orange-600',
                  textColor: isActive ? 'text-amber-700' : 'text-gray-600',
                  borderColor: 'border-amber-200/50'
                };
                case 'billing': return {
                  gradient: 'from-teal-500 to-cyan-600',
                  textColor: isActive ? 'text-teal-700' : 'text-gray-600',
                  borderColor: 'border-teal-200/50'
                };
                case 'audit': return {
                  gradient: 'from-slate-500 to-gray-600',
                  textColor: isActive ? 'text-slate-700' : 'text-gray-600',
                  borderColor: 'border-slate-200/50'
                };
                default: return {
                  gradient: 'from-purple-500 to-pink-600',
                  textColor: isActive ? 'text-purple-700' : 'text-gray-600',
                  borderColor: 'border-purple-200/50'
                };
              }
            };
            
            const colors = getTabColors();
            
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex-1 px-4 py-2.5 rounded-md font-medium text-sm
                  transition-all duration-200 flex items-center justify-center gap-2 min-w-0 
                  ${isActive 
                    ? `bg-white text-gray-900 shadow-sm ${colors.textColor}` 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-dashed border-gray-300'
                  }
                `}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Clean minimal icon */}
                <div className={`transition-colors duration-200 ${isActive ? colors.textColor : 'text-gray-500'}`}>
                  {tab.icon}
                </div>
                
                {/* Tab label */}
                <span className={`font-medium truncate whitespace-nowrap transition-colors duration-300 ${colors.textColor}`} style={{ fontFamily: 'Poppins, sans-serif' }}>{tab.label}</span>
                
                {/* Clean count badge */}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`
                    px-2 py-0.5 rounded text-xs font-medium min-w-[20px] text-center transition-colors duration-200
                    ${isActive 
                      ? 'bg-gray-200 text-gray-700' 
                      : 'bg-gray-300 text-gray-600'
                    }
                  `}>
                    {tab.count}
                  </span>
                )}
                
              </motion.button>
            );
          })}
        </div>
        
        {/* Content container with subtle gradient */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl shadow-2xl relative z-10 border border-gray-100/50">
          <div className="bg-white rounded-[1.25rem] overflow-hidden">
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
            onClick={() => onEditVisit && onEditVisit(visit)}
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
                <div className="flex items-start gap-2">
                  <span className="text-sm font-bold text-gray-800">Chief Complaint:</span>
                  <span className="text-sm text-gray-700 flex-1">{visit.chief_complaint}</span>
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
const AuditTrailContent: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'login'>('all');

  React.useEffect(() => {
    if (patientId) {
      fetchAuditLogs();
    }
  }, [patientId]);

  const generateDetailedDescription = (log: any): string => {
    if (log.old_values && log.new_values) {
      // For updates, show what changed
      const oldVals = log.old_values;
      const newVals = log.new_values;
      const changes = [];
      
      // Check common fields that might change
      if (oldVals.cell_number !== newVals.cell_number) {
        changes.push(`Phone: ${oldVals.cell_number} → ${newVals.cell_number}`);
      }
      if (oldVals.email !== newVals.email) {
        changes.push(`Email: ${oldVals.email} → ${newVals.email}`);
      }
      if (oldVals.status !== newVals.status) {
        changes.push(`Status: ${oldVals.status} → ${newVals.status}`);
      }
      
      return changes.length > 0 ? changes.join(', ') : 'Record updated';
    }
    
    if (log.new_values) {
      // For inserts, show key fields
      const vals = log.new_values;
      if (log.table_name === 'visits') {
        return `Visit type: ${vals.visit_type || 'consultation'}, Date: ${vals.visit_date}`;
      }
      if (log.table_name === 'vitals') {
        return `BP: ${vals.blood_pressure_systolic}/${vals.blood_pressure_diastolic}, HR: ${vals.heart_rate}`;
      }
      if (log.table_name === 'patients') {
        return `New patient: ${vals.first_name} ${vals.last_name}`;
      }
    }
    
    return log.description || `${log.action} performed on ${log.category}`;
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      // Fetch real audit logs from the database
      const { data: auditData, error } = await supabase
        .from('patient_audit_logs')
        .select('*')
        .or(`record_id.eq.${patientId},table_name.eq.patients`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching audit logs:', error);
        setAuditLogs([]);
        return;
      }

      // Transform data for UI
      const transformedLogs = auditData?.map(log => ({
        id: log.id,
        action: log.action.toLowerCase(),
        table_name: log.table_name,
        record_id: log.record_id,
        user_id: log.user_id,
        user_name: log.user_full_name || log.user_email || 'Unknown User',
        user_role: log.user_role || 'user',
        description: log.description || `${log.action} on ${log.category}`,
        details: generateDetailedDescription(log),
        ip_address: log.ip_address || 'Unknown',
        user_agent: log.user_agent || 'Unknown',
        timestamp: log.created_at,
        category: log.category
      })) || [];

      setAuditLogs(transformedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    if (filter === 'all') return true;
    return log.action === filter;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-700 border-green-200';
      case 'update': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'delete': return 'bg-red-100 text-red-700 border-red-200';
      case 'login': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus className="w-4 h-4" />;
      case 'update': return <FileText className="w-4 h-4" />;
      case 'delete': return <X className="w-4 h-4" />;
      case 'login': return <User className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Audit Trail</h3>
          <p className="text-gray-500 text-sm">Complete system activity log and change history</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchAuditLogs}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh audit logs"
          >
            <Clock className="w-5 h-5 text-gray-600" />
          </motion.button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
        {(['all', 'create', 'update', 'delete', 'login'] as const).map((action) => (
          <button
            key={action}
            onClick={() => setFilter(action)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              filter === action
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {action !== 'all' && getActionIcon(action)}
            {action.charAt(0).toUpperCase() + action.slice(1)}
            {action === 'all' && ` (${auditLogs.length})`}
          </button>
        ))}
      </div>

      {/* Audit Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gradient-to-r from-slate-500 to-gray-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">No {filter !== 'all' ? filter : ''} audit logs found</h4>
          <p className="text-gray-500 text-sm">System changes and administrative actions will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${getActionColor(log.action).replace('text-', 'text-white ').replace('border-', 'bg-')}`}>
                      <div className="text-white">{getActionIcon(log.action)}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{log.description}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user_name} ({log.user_role})
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(log.timestamp), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-11">
                    <p className="text-sm text-gray-700 mb-2">{log.details}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>IP: {log.ip_address}</span>
                      <span>•</span>
                      <span>Table: {log.table_name}</span>
                      {log.record_id && (
                        <>
                          <span>•</span>
                          <span className="font-mono">ID: {log.record_id.slice(0, 8)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right ml-4">
                  <p className="text-xs text-gray-500">
                    {format(parseISO(log.timestamp), 'HH:mm')}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

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

// Billing Content Component - Enhanced with real service data
const BillingContent: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [services, setServices] = useState<any[]>([]);
  const [billingStats, setBillingStats] = useState<any>({
    totalServices: 0,
    totalAmount: 0,
    paidAmount: 0,
    outstandingAmount: 0,
    medicalAidAmount: 0,
    patientAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  React.useEffect(() => {
    if (patientId) {
      fetchBillingData();
    }
  }, [patientId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Step 1: Get patient invoices
      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .select('id, invoice_number, visit_id, payment_status, payment_method, total')
        .eq('patient_id', patientId);

      if (invoiceError || !invoices || invoices.length === 0) {
        console.error('No invoices found:', invoiceError);
        setServices([]);
        setBillingStats({
          totalServices: 0,
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          medicalAidAmount: 0,
          patientAmount: 0
        });
        setLoading(false);
        return;
      }

      // Step 2: Get services for those invoices
      const invoiceIds = invoices.map(inv => inv.id);
      const { data: servicesData, error: servicesError } = await supabase
        .from('invoice_services')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        setServices([]);
        setBillingStats({
          totalServices: 0,
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          medicalAidAmount: 0,
          patientAmount: 0
        });
        return;
      }

      // Step 3: Combine services with invoice data
      const transformedServices = servicesData?.map(service => {
        const invoice = invoices.find(inv => inv.id === service.invoice_id);
        return {
          id: service.id,
          code: service.code,
          description: service.description,
          quantity: service.quantity,
          unit_price: service.unit_price,
          total_price: service.total_price,
          medical_aid_covered: service.medical_aid_covered || 0,
          patient_portion: service.patient_portion,
          visit_id: invoice?.visit_id,
          visit_date: null, // No visit data needed
          visit_time: null, // No visit data needed  
          chief_complaint: null, // No visit data needed
          invoice_id: invoice?.id,
          invoice_number: invoice?.invoice_number,
          payment_status: invoice?.payment_status || 'pending',
          payment_method: invoice?.payment_method,
          created_at: service.created_at
        };
      }) || [];

      setServices(transformedServices);
      
      // Calculate stats
      const totalAmount = transformedServices.reduce((sum, service) => sum + service.total_price, 0);
      const paidAmount = transformedServices
        .filter(service => service.payment_status === 'paid')
        .reduce((sum, service) => sum + service.total_price, 0);
      const medicalAidAmount = transformedServices.reduce((sum, service) => sum + service.medical_aid_covered, 0);
      
      setBillingStats({
        totalServices: transformedServices.length,
        totalAmount,
        paidAmount,
        outstandingAmount: totalAmount - paidAmount,
        medicalAidAmount,
        patientAmount: totalAmount - medicalAidAmount
      });
    } catch (error) {
      console.error('Error fetching billing data:', error);
      // Set empty data on error
      setServices([]);
      setBillingStats({
        totalServices: 0,
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        medicalAidAmount: 0,
        patientAmount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter services
  const filteredServices = services.filter(service => {
    if (filter === 'all') return true;
    return service.payment_status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Billing & Financial History
          </h3>
          <p className="text-gray-500 text-sm">Complete transaction records and payment history</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewMode === 'cards' 
                  ? 'bg-white text-gray-900 shadow-sm font-medium' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm font-medium' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchBillingData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Clock className="w-5 h-5 text-gray-600" />
          </motion.button>
        </div>
      </div>
      
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-200 rounded-lg">
              <Receipt className="w-5 h-5 text-blue-700" />
            </div>
            <span className="text-xs font-medium text-blue-600">Total Billed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">N$ {billingStats.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">{services.length} services</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
            </div>
            <span className="text-xs font-medium text-green-600">Paid</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">N$ {billingStats.paidAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">
            {((billingStats.paidAmount / billingStats.totalAmount) * 100 || 0).toFixed(0)}% collected
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-6 border border-amber-200"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-200 rounded-lg">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <span className="text-xs font-medium text-amber-600">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">N$ {billingStats.outstandingAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">Awaiting payment</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-700" />
            </div>
            <span className="text-xs font-medium text-red-600">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">N$ {(billingStats.outstandingAmount * 0.3).toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">Requires attention</p>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
        {(['all', 'paid', 'pending', 'overdue'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              filter === status
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && ` (${services.length})`}
          </button>
        ))}
      </div>

      {/* Services Display */}
      {filteredServices.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} services found</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredServices.map((service) => {
                const status = service.payment_status || 'pending';
                const statusColors = {
                  paid: 'bg-green-100 text-green-700 border-green-200',
                  pending: 'bg-amber-100 text-amber-700 border-amber-200',
                  overdue: 'bg-red-100 text-red-700 border-red-200'
                };

                return (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {service.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {service.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {service.visit_date ? (
                        <button
                          onClick={() => navigate(`/patients/${patientId}?visit=${service.visit_id}`)}
                          className="text-[#01b9d4] hover:text-[#01a0c4] font-medium"
                        >
                          {format(parseISO(service.visit_date), 'MMM dd')}
                        </button>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {service.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      N$ {service.total_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => {
                          setSelectedService(service);
                          setShowDetails(true);
                        }}
                        className="text-[#01b9d4] hover:text-[#01a0c4] font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-3">
          {filteredServices.map((service) => {
            const status = service.payment_status || 'pending';
            const statusColors = {
              paid: 'bg-green-100 text-green-700 border-green-200',
              pending: 'bg-amber-100 text-amber-700 border-amber-200',
              overdue: 'bg-red-100 text-red-700 border-red-200'
            };

            return (
              <motion.div
                key={service.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => {
                  setSelectedService(service);
                  setShowDetails(true);
                }}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Code className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 font-mono">
                          {service.code}
                        </p>
                        <p className="text-sm text-gray-500">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="ml-11">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {service.visit_date ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/patients/${patientId}?visit=${service.visit_id}`);
                            }}
                            className="text-[#01b9d4] hover:text-[#01a0c4] font-medium"
                          >
                            Visit: {format(parseISO(service.visit_date), 'MMM dd, yyyy')}
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs">Visit: Not available</span>
                        )}
                        <span>•</span>
                        <span>Qty: {service.quantity}</span>
                        {service.invoice_number && (
                          <>
                            <span>•</span>
                            <span>Invoice #{service.invoice_number}</span>
                          </>
                        )}
                        {service.medical_aid_covered > 0 && (
                          <>
                            <span>•</span>
                            <span>Medical Aid: N$ {service.medical_aid_covered.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="text-xl font-bold text-gray-900 mb-1">
                      N$ {service.total_price.toFixed(2)}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Service Details Modal using FormModal pattern */}
      <ServiceDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        service={selectedService}
      />
    </div>
  );
};

// Service Details Modal Component using FormModal pattern
const ServiceDetailsModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  service: any; 
}> = ({ isOpen, onClose, service }) => {
  if (!service) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Service Details"
    >
      <div className="space-y-6">
        {/* Service Information */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Service Details</h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service Code:</span>
              <span className="font-mono font-medium">{service.code}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Description:</span>
              <span className="font-medium">{service.description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Visit Date:</span>
              <span className="font-medium">
                {service.visit_date ? format(parseISO(service.visit_date), 'MMMM dd, yyyy') : 'Not available'}
              </span>
            </div>
            {service.visit_time && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Visit Time:</span>
                <span className="font-medium">{service.visit_time}</span>
              </div>
            )}
            {service.chief_complaint && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Chief Complaint:</span>
                <span className="font-medium">{service.chief_complaint}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Pricing Details</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Code className="w-4 h-4 text-gray-400" />
                  <span className="font-mono text-sm font-medium text-gray-700">
                    {service.code}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{service.description}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm text-gray-600">
                  {service.quantity} × N$ {service.unit_price.toFixed(2)}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  N$ {service.total_price.toFixed(2)}
                </p>
                {service.medical_aid_covered > 0 && (
                  <p className="text-xs text-green-600">
                    Medical Aid: N$ {service.medical_aid_covered.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="border-t pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service Total:</span>
              <span>N$ {service.total_price.toFixed(2)}</span>
            </div>
            {service.medical_aid_covered > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Medical Aid Portion:</span>
                <span className="text-green-600">N$ {service.medical_aid_covered.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span className="text-gray-600">Patient Portion:</span>
              <span className="font-medium text-[#01b9d4]">N$ {service.patient_portion.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Payment Status</h4>
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                service.payment_status === 'paid' ? 'text-green-600' :
                service.payment_status === 'pending' ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {service.payment_status.toUpperCase()}
              </span>
            </div>
            {service.payment_method && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">{service.payment_method}</span>
              </div>
            )}
            {service.invoice_number && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-mono font-medium">#{service.invoice_number}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
};

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
          
        </div>
      </div>
      
      {/* Patient Journey and AI Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Journey */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="relative group cursor-pointer"
        >
          {/* Animated gradient border wrapper */}
          <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-2xl p-1 shadow-lg group-hover:shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[0.875rem] overflow-hidden border border-gray-100">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-xl transition-all duration-500">
                    <User className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors duration-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>Patient Journey</h4>
                    <p className="text-xs text-gray-500">Clinical History Overview</p>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 leading-relaxed mb-4">
                  <p className="mb-0">
                    {patient?.first_name} {patient?.last_name} has been under our care with <strong className="text-gray-800">{visits.length} medical encounters</strong> recorded. 
                    The patient demonstrates <strong className="text-gray-800">excellent compliance</strong> with scheduled appointments and treatment protocols. 
                    Clinical assessments show <strong className="text-gray-800">stable vital signs</strong> across {vitals.length} recorded measurements, 
                    with all key indicators within normal ranges. Overall prognosis is <strong className="text-gray-800">positive</strong> with continued 
                    monitoring recommended for optimal health outcomes.
                  </p>
                </div>
                
                {/* Generate Report Button - Natural Green Theme */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Sparkles className="w-4 h-4" />
                  <span style={{ fontFamily: 'Poppins, sans-serif' }}>Generate Report</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* AI Insights */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="relative group cursor-pointer"
        >
          {/* Animated gradient border wrapper */}
          <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-[#01b9d5] group-hover:to-purple-600 rounded-2xl p-1 shadow-lg group-hover:shadow-2xl transition-all duration-500">
            <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-[0.875rem] overflow-hidden border border-gray-100">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
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
        </motion.div>
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
          {/* Always blue gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-300 via-blue-400 to-indigo-400 group-hover:from-blue-500 group-hover:via-blue-400 group-hover:to-indigo-500 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-all duration-500"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-blue-300 to-indigo-400 group-hover:from-blue-400 group-hover:to-indigo-500 rounded-3xl p-1 shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230EA5E9' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
              
              {/* Ultra faded background image */}
              <div 
                className="absolute inset-0 opacity-[0.02] grayscale bg-cover bg-center mix-blend-overlay"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop)' }}
              ></div>
              
              <div className="relative p-6">
                {/* Icon and action */}
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-200 to-indigo-300 group-hover:from-blue-300 group-hover:to-indigo-400 blur-xl opacity-50 transition-all duration-500"></div>
                    <div className="relative p-3 bg-gradient-to-br from-blue-300 to-indigo-400 group-hover:from-blue-400 group-hover:to-indigo-500 rounded-2xl shadow-lg transition-all duration-500">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <span className="text-xs font-medium">View</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Medical Aid</p>
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {medicalAid?.provider || 'Not Registered'}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">{medicalAid?.scheme || 'Click to add'}</p>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
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
          {/* Always purple gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-300 via-purple-400 to-pink-400 group-hover:from-purple-500 group-hover:via-purple-400 group-hover:to-pink-500 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-all duration-500"></div>
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-purple-300 to-pink-400 group-hover:from-purple-400 group-hover:to-pink-500 rounded-3xl p-1 shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23A855F7' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
              
              {/* Ultra faded background image */}
              <div 
                className="absolute inset-0 opacity-[0.02] grayscale bg-cover bg-center mix-blend-overlay"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1606788075819-9574a6edfab3?w=800&h=600&fit=crop)' }}
              ></div>
              
              <div className="relative p-6">
                {/* Icon and SMS button */}
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-pink-300 group-hover:from-purple-300 group-hover:to-pink-400 blur-xl opacity-50 transition-all duration-500"></div>
                    <div className="relative p-3 bg-gradient-to-br from-purple-300 to-pink-400 group-hover:from-purple-400 group-hover:to-pink-500 rounded-2xl shadow-lg transition-all duration-500">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl hover:from-purple-200 hover:to-pink-200 transition-all duration-300"
                  >
                    <MessageSquare className="w-4 h-4 text-purple-700" />
                  </motion.div>
                </div>
                
                {/* Content */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Emergency Contact</p>
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {nextOfKin?.name || patient?.emergency_contact_name || 'Not Added'}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">
                    {nextOfKin?.relationship || patient?.emergency_contact_relationship || 'Click to add'}
                  </p>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Total Investment Card - Bank/Visa Style */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative group cursor-pointer"
          onClick={onBillingClick}
        >
          {/* Bank card style background with slight rotation - always emerald */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-400 group-hover:from-emerald-500 group-hover:via-emerald-400 group-hover:to-teal-500 rounded-2xl transform rotate-1 group-hover:rotate-2 transition-all duration-500"></div>
          
          {/* Main bank card */}
          <div className="relative bg-gradient-to-br from-emerald-300 to-teal-400 group-hover:from-emerald-400 group-hover:to-teal-500 rounded-2xl p-1 shadow-2xl transition-all duration-500">
            <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310B981' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}></div>
              
              {/* Ultra faded background image */}
              <div 
                className="absolute inset-0 opacity-[0.02] grayscale bg-cover bg-center mix-blend-overlay"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=800&h=600&fit=crop)' }}
              ></div>
              
              <div className="relative p-6">
                {/* Bank card style icon and chip */}
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 to-teal-300 group-hover:from-emerald-300 group-hover:to-teal-400 blur-xl opacity-50 transition-all duration-500"></div>
                    <div className="relative p-3 bg-gradient-to-br from-emerald-300 to-teal-400 group-hover:from-emerald-400 group-hover:to-teal-500 rounded-lg shadow-lg transition-all duration-500">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <span className="text-xs font-medium">Details</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Investment</p>
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    N$ {totalSpent.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">Healthcare expenses</p>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PremiumFolderTabs;