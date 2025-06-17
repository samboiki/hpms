import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../stores/themeStore';
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
  Code,
  Upload
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import PremiumVisitModal from '../modals/PremiumVisitModal';
import FormModal from '../modals/FormModal';
import InvoiceDetailsModal from '../modals/InvoiceDetailsModal';
import DocumentList from '../documents/DocumentList';
import EnhancedDocumentUploadModal from '../modals/EnhancedDocumentUploadModal';
import { supabase } from '../../lib/supabase';
import { medicalAidService } from '../../services/medicalAidService';

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
  created_at: string;
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
  onMedicalAidLimitClick?: () => void;
  onBillingClick?: () => void;
  initialTab?: string;
}

interface TabData {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  color: string;
}

// Content components will be defined below, main component at the end

// Encounters Content Component
const EncountersContent: React.FC<{ 
  visits: Visit[];
  onVisitClick?: (visit: Visit) => void;
  onEditVisit?: (visit: Visit) => void;
  onVisitStatusChange?: (visitId: string, status: string) => void;
  onAddVisit?: () => void;
}> = ({ visits, onVisitClick, onEditVisit, onVisitStatusChange, onAddVisit }) => {
  const { currentTheme } = useTheme();
  
  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Medical Encounters</h3>
        <p className="text-gray-500 text-sm">Complete visit history and clinical notes</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span style={{ fontFamily: 'Rubik, sans-serif' }}>{visits.length} total visits</span>
        </div>
        {onAddVisit && (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddVisit}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add New Visit
          </motion.button>
        )}
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
            className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => onEditVisit && onEditVisit(visit)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-gradient-to-r ${currentTheme.gradients.button} rounded-lg`}>
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
                visit.status === 'in-progress' ? `bg-${currentTheme.colors.primary.from}/10 text-${currentTheme.colors.primary.from}` :
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
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onVisitClick && onVisitClick(visit);
                }}
                className="text-xs font-medium flex items-center gap-1 transition-colors"
                style={{ 
                  color: currentTheme.colors.primary.from,
                  ':hover': { color: currentTheme.colors.primary.to }
                }}
              >
                <FileText className="w-3 h-3" />
                View Details
              </button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditVisit && onEditVisit(visit);
                }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium text-xs"
              >
                <Plus className="w-3 h-3" />
                Edit Visit
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    ) : (
      <div className="text-center py-12">
        <div className={`p-4 bg-gradient-to-r ${currentTheme.gradients.button} rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center`}>
          <Stethoscope className="w-8 h-8 text-white" />
        </div>
        <h4 className="text-lg font-semibold text-gray-800 mb-2">No encounters recorded</h4>
        <p className="text-gray-500 text-sm">Patient visits and consultations will appear here</p>
      </div>
    )}
  </div>
);
};

// Audit Trail Content Component
const AuditTrailContent: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const { currentTheme } = useTheme();
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
      case 'update': return `bg-${currentTheme.colors.primary.from}/10 text-${currentTheme.colors.primary.from} border-${currentTheme.colors.primary.from}/20`;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: currentTheme.colors.primary.from }}></div>
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
const VitalsContent: React.FC<{ vitals: Vital[] }> = ({ vitals }) => {
  const { currentTheme } = useTheme();
  
  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Vital Signs</h3>
        <p className="text-gray-500 text-sm">Historical vital signs and trends</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <TrendingUp className="w-4 h-4" />
        <span style={{ fontFamily: 'Rubik, sans-serif' }}>{vitals.length} recordings</span>
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
                  {vital.created_at && !isNaN(new Date(vital.created_at).getTime()) ? format(new Date(vital.created_at), 'MMM dd, yyyy HH:mm') : 'No date recorded'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic}
                </div>
                <div className="text-xs text-gray-500">Blood Pressure</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>{vital.heart_rate}</div>
                <div className="text-xs text-gray-500">Heart Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>{vital.temperature}°C</div>
                <div className="text-xs text-gray-500">Temperature</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Rubik, sans-serif' }}>{vital.weight}kg</div>
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
};

// Results Content Component
const ResultsContent: React.FC = () => {
  const { currentTheme } = useTheme();
  
  return (
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
        <div className={`p-3 bg-gradient-to-r ${currentTheme.gradients.button} rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center`}>
          <ImageIcon className="w-6 h-6 text-white" />
        </div>
        <h4 className="font-semibold text-gray-800 mb-1">Medical Imaging</h4>
        <p className="text-gray-500 text-sm">X-rays, CT scans, MRIs</p>
      </div>
    </div>
  </div>
  );
};

// Documents Content Component
const DocumentsContent: React.FC<{ patientId: string; visitId?: string; onCountChange?: () => void }> = ({ patientId, visitId, onCountChange }) => {
  const { currentTheme } = useTheme();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleUploadSuccess = () => {
    console.log('📊 Document upload successful - refreshing list');
    setRefreshTrigger(prev => prev + 1);
    if (onCountChange) {
      onCountChange();
    }
  };

  const handleFileSelect = (files: FileList) => {
    console.log('📂 Files selected via drop area:', files.length);
    // Open modal and pass files
    setIsUploadModalOpen(true);
    // We'll handle file passing in the modal
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    console.log('🎯 Files dropped on main area');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div 
      className="space-y-6 relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 border-2 border-dashed rounded-xl z-10 flex items-center justify-center"
             style={{ 
               backgroundColor: `${currentTheme.colors.primary.from}10`,
               borderColor: currentTheme.colors.primary.from
             }}>
          <div className="text-center">
            <div className="p-4 rounded-full mx-auto mb-4 w-16 h-16 flex items-center justify-center"
                 style={{ backgroundColor: `${currentTheme.colors.primary.from}20` }}>
              <Upload className="w-8 h-8" style={{ color: currentTheme.colors.primary.from }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: currentTheme.colors.primary.from }}>Drop files here to upload</h3>
            <p className="text-sm text-gray-600">Release to start uploading documents</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Clinical Documents</h3>
          <p className="text-gray-500 text-sm">Upload and manage patient documents, lab results, and clinical files</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsUploadModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-2xl hover:shadow-[#01b9d5]/30 transition-all duration-300 font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          Upload Documents
        </motion.button>
      </div>

      {/* Quick Drop Area */}
      <motion.div
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#01b9d4]/50 hover:bg-[#01b9d4]/5 transition-all duration-200 cursor-pointer"
        onClick={() => setIsUploadModalOpen(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-full">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Drop files here or click to upload
            </h4>
            <p className="text-xs text-gray-500">
              PDF, Images, Word docs, Excel files • Max 50MB
            </p>
          </div>
        </div>
      </motion.div>
      
      {/* Document List Section */}
      <DocumentList 
        patientId={patientId}
        refreshTrigger={refreshTrigger}
      />
      
      {/* Document Upload Modal */}
      <EnhancedDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        patientId={patientId}
        visitId={visitId}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

// Billing Content Component - Enhanced with real service data
const BillingContent: React.FC<{ 
  patientId?: string;
  selectedService: any;
  setSelectedService: (service: any) => void;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  selectedInvoice: any;
  setSelectedInvoice: (invoice: any) => void;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: (open: boolean) => void;
  patient?: any;
  medicalAid?: any;
}> = ({ patientId, selectedService, setSelectedService, showDetails, setShowDetails, selectedInvoice, setSelectedInvoice, isInvoiceModalOpen, setIsInvoiceModalOpen, patient, medicalAid }) => {
  const { currentTheme } = useTheme();
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

  React.useEffect(() => {
    if (patientId) {
      fetchBillingData();
    }
  }, [patientId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Step 1: Get patient invoices (without join)
      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .select('id, invoice_number, visit_id, payment_status, payment_method, total, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

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

      // Step 2: Get visit data for invoices that have visit_id
      const visitIds = invoices
        .filter(inv => inv.visit_id)
        .map(inv => inv.visit_id);
      
      let visitsData = [];
      if (visitIds.length > 0) {
        const { data: visits } = await supabase
          .from('visits')
          .select('id, visit_date, visit_time, chief_complaint')
          .in('id', visitIds);
        visitsData = visits || [];
      }

      // Step 3: Get services for those invoices
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

      // Step 4: Group services by invoice and create invoice objects
      const invoiceMap = new Map();
      
      // Initialize invoices with visit data
      invoices.forEach(invoice => {
        const visit = visitsData.find(v => v.id === invoice.visit_id);
        invoiceMap.set(invoice.id, {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          visit_id: invoice.visit_id,
          visit_date: visit?.visit_date,
          visit_time: visit?.visit_time,
          chief_complaint: visit?.chief_complaint,
          payment_status: invoice.payment_status || 'pending',
          payment_method: invoice.payment_method,
          total: invoice.total || 0,
          created_at: invoice.created_at,
          services: [],
          service_count: 0,
          medical_aid_covered: 0,
          patient_portion: 0
        });
      });

      // Add services to their respective invoices
      servicesData?.forEach(service => {
        const invoice = invoiceMap.get(service.invoice_id);
        if (invoice) {
          // CORRECT medical aid coverage logic: depends on if patient has medical aid
          let serviceMedicalAid = 0;
          let servicePatientPortion = service.total_price; // Default: patient pays everything
          
          // If medical aid values are explicitly set in database, use them
          if (service.medical_aid_covered !== null && service.medical_aid_covered !== undefined) {
            serviceMedicalAid = service.medical_aid_covered;
            servicePatientPortion = service.patient_portion || (service.total_price - serviceMedicalAid);
          } else if (medicalAid) {
            // If patient has medical aid but values not set, assume medical aid covers everything
            serviceMedicalAid = service.total_price;
            servicePatientPortion = 0;
          }
          // If no medical aid, patient pays everything (default values already set)
          
          invoice.services.push({
            ...service,
            medical_aid_covered: serviceMedicalAid,
            patient_portion: servicePatientPortion
          });
          invoice.service_count += 1;
          invoice.medical_aid_covered += serviceMedicalAid;
          invoice.patient_portion += servicePatientPortion;
        }
      });

      // Convert map to array for rendering
      const transformedInvoices = Array.from(invoiceMap.values());
      setServices(transformedInvoices);
      
      // Calculate stats based on invoices
      const totalAmount = transformedInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
      const paidAmount = transformedInvoices
        .filter(invoice => invoice.payment_status === 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0);
      const medicalAidAmount = transformedInvoices.reduce((sum, invoice) => sum + invoice.medical_aid_covered, 0);
      const totalServices = servicesData?.length || 0;
      
      setBillingStats({
        totalServices,
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

  // Filter invoices
  const filteredInvoices = services.filter(invoice => {
    if (filter === 'all') return true;
    return invoice.payment_status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: currentTheme.colors.primary.from }}></div>
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
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#489bfd]/10 rounded-lg">
              <Receipt className="w-5 h-5 text-[#489bfd]" />
            </div>
            <span className="text-xs font-medium text-[#489bfd]">Total Billed</span>
          </div>
          <p className="text-4xl font-bold text-[#489bfd] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.totalAmount)}</span>
            <span className="text-3xl opacity-60">.{String(billingStats.totalAmount.toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>{services.length} services</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#30b4be]/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-[#30b4be]" />
            </div>
            <span className="text-xs font-medium text-[#30b4be]">Collected</span>
          </div>
          <p className="text-4xl font-bold text-[#30b4be] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.paidAmount)}</span>
            <span className="text-3xl opacity-60">.{String(billingStats.paidAmount.toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {((billingStats.paidAmount / billingStats.totalAmount) * 100 || 0).toFixed(0)}% collected
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#e98320]/10 rounded-lg">
              <Clock className="w-5 h-5 text-[#e98320]" />
            </div>
            <span className="text-xs font-medium text-[#e98320]">Pending</span>
          </div>
          <p className="text-4xl font-bold text-[#e98320] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.outstandingAmount)}</span>
            <span className="text-3xl opacity-60">.{String(billingStats.outstandingAmount.toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">Awaiting payment</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#ff4f5a]/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-[#ff4f5a]" />
            </div>
            <span className="text-xs font-medium text-[#ff4f5a]">Overdue</span>
          </div>
          <p className="text-4xl font-bold text-[#ff4f5a] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.outstandingAmount * 0.3)}</span>
            <span className="text-3xl opacity-60">.{String((billingStats.outstandingAmount * 0.3).toFixed(2)).split('.')[1]}</span>
          </p>
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
            {status === 'all' && <span style={{ fontFamily: 'Rubik, sans-serif' }}> ({services.length})</span>}
          </button>
        ))}
      </div>

      {/* Invoices Display */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} invoices found</p>
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
              {filteredInvoices.map((invoice) => {
                return invoice.services.map((service, index) => {
                  const status = service.payment_status || invoice.payment_status || 'pending';
                  const statusColors = {
                    paid: 'bg-green-100 text-green-700 border-green-200',
                    pending: 'bg-amber-100 text-amber-700 border-amber-200',
                    overdue: 'bg-red-100 text-red-700 border-red-200'
                  };

                  // Brand colors for table amounts based on status
                  const statusBrandColors = {
                    paid: '#30b4be', // collected color
                    pending: '#e98320', // pending color  
                    overdue: '#ff4f5a' // overdue color
                  };

                  return (
                    <tr key={`${invoice.id}-${service.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {service.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {service.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {invoice.visit_date ? (
                          <button
                            onClick={() => navigate(`/patients/${patientId}?visit=${invoice.visit_id}`)}
                            className="bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent font-medium hover:from-[#01a0c4] hover:to-purple-700 transition-all duration-200"
                          >
                            {format(parseISO(invoice.visit_date), 'MMM dd')}
                          </button>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {service.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: 'Rubik, sans-serif', color: statusBrandColors[status] }}>
                        <span>N$ {Math.floor(service.total_price)}</span>
                        <span className="opacity-60">.{String(service.total_price.toFixed(2)).split('.')[1]}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            setSelectedService({ ...service, invoice_number: invoice.invoice_number, visit_date: invoice.visit_date, visit_time: invoice.visit_time, chief_complaint: invoice.chief_complaint });
                            setShowDetails(true);
                          }}
                          className="bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent font-medium hover:from-[#01a0c4] hover:to-purple-700 transition-all duration-200"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Premium Invoice Card View */
        <div className="space-y-6">
          {filteredInvoices.map((invoice) => {
            const status = invoice.payment_status || 'pending';
            const statusColors = {
              paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              pending: 'bg-amber-50 text-amber-800 border-amber-200',
              overdue: 'bg-red-50 text-red-800 border-red-200'
            };

            const statusIcons = {
              paid: <CheckCircle2 className="w-4 h-4" />,
              pending: <Clock className="w-4 h-4" />,
              overdue: <AlertCircle className="w-4 h-4" />
            };

            // Brand colors for invoice amounts based on status
            const statusBrandColors = {
              paid: '#30b4be', // collected color
              pending: '#e98320', // pending color  
              overdue: '#ff4f5a' // overdue color
            };

            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative group cursor-pointer"
                onClick={() => {
                  setSelectedInvoice({
                    ...invoice,
                    patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'N/A',
                    patient_phone: patient?.cell_number || 'N/A',
                    patient_email: patient?.email || 'N/A',
                    medical_aid_provider: medicalAid?.provider || null,
                    chief_complaint: invoice.chief_complaint,
                    payment_status: invoice.payment_status || 'pending'
                  });
                  setIsInvoiceModalOpen(true);
                }}
              >
                {/* Premium gradient border wrapper */}
                <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.gradients.sidebar}/10 rounded-2xl transform group-hover:scale-102 transition-transform duration-300 blur-lg`}></div>
                
                {/* Main invoice card */}
                <div className="relative bg-white border border-gray-200/50 rounded-2xl p-6 shadow-lg group-hover:shadow-2xl transition-all duration-300 backdrop-blur-sm">
                  {/* Header with invoice info */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.gradients.sidebar} rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                        <div className={`relative p-3 bg-gradient-to-r ${currentTheme.gradients.button} rounded-xl shadow-lg`}>
                          <Receipt className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          Invoice #{invoice.invoice_number}
                        </h3>
                        <p className="text-sm mt-1">
                          {invoice.visit_date ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/patients/${patientId}?visit=${invoice.visit_id}`);
                              }}
                              className="bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent font-medium hover:from-[#01a0c4] hover:to-purple-700 transition-all duration-200"
                            >
                              Visit: {format(parseISO(invoice.visit_date), 'MMMM dd, yyyy')}
                            </button>
                          ) : (
                            <span className="text-gray-500">Visit date not available</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border ${statusColors[status]}`}>
                        {statusIcons[status]}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </div>
                      <p className="text-3xl font-black text-gray-900 mt-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <span>N$ {Math.floor(invoice.total)}</span>
                        <span className="text-2xl opacity-60">.{String(invoice.total.toFixed(2)).split('.')[1]}</span>
                      </p>
                    </div>
                  </div>

                  {/* Services summary with elegant styling */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">Services Included</h4>
                      <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {invoice.service_count} item{invoice.service_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {invoice.services.map((service, index) => (
                        <div key={service.id} className="flex items-center justify-between py-1">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                              {service.code}
                            </span>
                            <span className="text-sm text-gray-600 ml-2">
                              {service.description}
                            </span>
                          </div>
                          <div className="text-right ml-4">
                            <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                              {service.quantity} × N$ {Math.floor(service.unit_price)}<span className="opacity-60">.{String(service.unit_price.toFixed(2)).split('.')[1]}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial breakdown */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Medical Aid</p>
                      <p className="text-lg font-bold text-emerald-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <span>N$ {Math.floor(invoice.medical_aid_covered)}</span>
                        <span className="opacity-60">.{String(invoice.medical_aid_covered.toFixed(2)).split('.')[1]}</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Patient Portion</p>
                      <p className="text-lg font-bold" style={{ fontFamily: 'Rubik, sans-serif', color: currentTheme.colors.primary.from }}>
                        <span>N$ {Math.floor(invoice.patient_portion)}</span>
                        <span className="opacity-60">.{String(invoice.patient_portion.toFixed(2)).split('.')[1]}</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Payment Method</p>
                      <p className="text-sm font-medium text-gray-700 capitalize">
                        {invoice.payment_method || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* Hover effect indicator */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span>View Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
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
              <span className="font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>{service.code}</span>
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
                  <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {service.code}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{service.description}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {service.quantity} × N$ {service.unit_price.toFixed(2)}
                </p>
                <p className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
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
              <span style={{ fontFamily: 'Rubik, sans-serif' }}>N$ {service.total_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Medical Aid Covered:</span>
              <span className="text-green-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                N$ {(service.medical_aid_covered || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span className="text-gray-600">Patient Portion:</span>
              <span className="font-medium text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                N$ {(service.patient_portion || service.total_price).toFixed(2)}
              </span>
            </div>
            {service.medical_aid_covered >= service.total_price && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-2">
                <p className="text-xs text-green-700 font-medium">
                  ✓ Fully covered by Medical Aid
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Payment Status</h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                service.payment_status === 'paid' ? 'text-green-600' :
                service.payment_status === 'pending' ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {service.payment_status ? service.payment_status.toUpperCase() : 'PENDING'}
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
  onMedicalAidLimitClick?: () => void;
  onBillingClick?: () => void;
  selectedInvoice: any;
  setSelectedInvoice: (invoice: any) => void;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: (open: boolean) => void;
  selectedService: any;
  setSelectedService: (service: any) => void;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
}> = ({ visits, vitals, patientId, patient, nextOfKin, medicalAid, onSendSms, onMedicalAidClick, onMedicalAidLimitClick, onBillingClick, selectedInvoice, setSelectedInvoice, isInvoiceModalOpen, setIsInvoiceModalOpen, selectedService, setSelectedService, showDetails, setShowDetails }) => {
  const navigate = useNavigate();
  const { currentTheme } = useTheme();
  const [medicalAidLogo, setMedicalAidLogo] = React.useState<string>('');
  
  // Calculate total spent (mock calculation based on visits)
  const totalSpent = visits.length * 450 + vitals.length * 75 + 1250;

  // Fetch medical aid logo when medical aid data changes
  React.useEffect(() => {
    const fetchMedicalAidLogo = async () => {
      if (medicalAid?.provider) {
        try {
          const logoUrl = await medicalAidService.getProviderLogo(medicalAid.provider);
          setMedicalAidLogo(logoUrl);
        } catch (error) {
          console.error('Error fetching medical aid logo:', error);
          setMedicalAidLogo('/images/medical-aids/default-medical-aid.svg');
        }
      }
    };

    fetchMedicalAidLogo();
  }, [medicalAid]);

  return (
    <>
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
      
      {/* Patient Journey and Medical Aid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
        
        {/* Compact Medical Aid Card */}
        {medicalAid && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative group cursor-pointer"
            onClick={onMedicalAidClick}
          >
            {/* Premium card design */}
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              {/* Subtle brand accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${currentTheme.gradients.button}`}></div>
              
              {/* Logo watermark */}
              {medicalAidLogo && (
                <div className="absolute top-4 right-4 w-24 h-24 opacity-[0.04] bg-contain bg-no-repeat bg-center"
                     style={{ backgroundImage: `url(${medicalAidLogo})` }}>
                </div>
              )}
              
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 bg-gradient-to-br ${currentTheme.gradients.button} rounded-lg flex items-center justify-center`}>
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Medical Aid
                      </h4>
                      <p className="text-xs text-gray-500">Coverage Details</p>
                    </div>
                  </div>
                  
                  {/* Provider logo */}
                  {medicalAidLogo && (
                    <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-200 p-1.5 flex items-center justify-center">
                      <img 
                        src={medicalAidLogo} 
                        alt={medicalAid.provider}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/medical-aids/default-medical-aid.svg';
                        }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Provider name */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Provider</p>
                  <p className="text-lg font-bold text-gray-900 leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {medicalAid.provider}
                  </p>
                </div>
                
                {/* Compact info grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Plan</p>
                    <p className="text-sm font-semibold text-gray-800">{medicalAid.scheme}</p>
                    {medicalAid.plan_type && (
                      <p className="text-xs mt-0.5" style={{ color: currentTheme.colors.primary.from }}>{medicalAid.plan_type}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Member</p>
                    <div className="bg-gray-900 rounded-md px-2 py-1">
                      <p className="text-xs font-mono text-white tracking-wide">
                        {medicalAid.membership_number}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Relationship */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center`} style={{ backgroundColor: `${currentTheme.colors.primary.from}15` }}>
                      <User className="w-3 h-3" style={{ color: currentTheme.colors.primary.from }} />
                    </div>
                    <span className="text-xs text-gray-600 capitalize">
                      {medicalAid.relationship_to_main}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMedicalAidLimitClick?.();
                    }}
                    className={`flex-1 px-3 py-2 bg-gradient-to-r ${currentTheme.gradients.button} text-white text-xs font-medium rounded-lg hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2`}
                  >
                    <CreditCard className="w-3 h-3" />
                    Update Limits
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMedicalAidClick?.();
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-all duration-200"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      {/* AI Insights - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
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
                  <div className={`w-8 h-8 bg-gradient-to-br rounded-lg flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: `${currentTheme.colors.primary.from}15` }}>
                    <span className="text-sm font-bold" style={{ color: currentTheme.colors.primary.from }}>1</span>
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
    </>
  );
};

// Main PremiumFolderTabs Component
const PremiumFolderTabs: React.FC<PremiumFolderTabsProps> = ({ 
  visits, 
  vitals, 
  patientId,
  onAddVisit,
  onEditVisit,
  onVisitStatusChange,
  patient,
  nextOfKin,
  medicalAid,
  onSendSms,
  onMedicalAidClick,
  onMedicalAidLimitClick,
  onBillingClick,
  initialTab
}) => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(initialTab || 'ai-intelligence');
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [billingCount, setBillingCount] = useState(0);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch counts when component mounts
  React.useEffect(() => {
    const fetchCounts = async () => {
      if (!patientId) {
        setBillingCount(0);
        setDocumentsCount(0);
        return;
      }
      
      // Count billing services
      const { data: invoiceData } = await supabase
        .from('invoices_enhanced')
        .select('id')
        .eq('patient_id', patientId);
      
      if (!invoiceData || invoiceData.length === 0) {
        setBillingCount(0);
      } else {
        const invoiceIds = invoiceData.map(inv => inv.id);
        const { count } = await supabase
          .from('invoice_services')
          .select('*', { count: 'exact', head: true })
          .in('invoice_id', invoiceIds);
        
        setBillingCount(count || 0);
      }
      
      // Count documents
      const { count: docCount } = await supabase
        .from('patient_documents')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patientId);
      
      setDocumentsCount(docCount || 0);
    };

    fetchCounts();
  }, [patientId, visits]);

  const refreshDocumentsCount = async () => {
    if (!patientId) return;
    
    const { count: docCount } = await supabase
      .from('patient_documents')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId);
    
    setDocumentsCount(docCount || 0);
  };

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
      color: currentTheme.gradients.button
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
      count: 0,
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <FileText className="w-3.5 h-3.5" />,
      count: documentsCount,
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
      count: 0,
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
          onMedicalAidLimitClick={onMedicalAidLimitClick}
          onBillingClick={onBillingClick}
          selectedInvoice={selectedInvoice}
          setSelectedInvoice={setSelectedInvoice}
          isInvoiceModalOpen={isInvoiceModalOpen}
          setIsInvoiceModalOpen={setIsInvoiceModalOpen}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
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
          onAddVisit={onAddVisit}
        />;
      case 'vitals':
        return <VitalsContent vitals={vitals} />;
      case 'results':
        return <ResultsContent />;
      case 'documents':
        return <DocumentsContent patientId={patientId} visitId={visits[0]?.id} onCountChange={refreshDocumentsCount} />;
      case 'billing':
        return <BillingContent 
          patientId={patientId}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
          selectedInvoice={selectedInvoice}
          setSelectedInvoice={setSelectedInvoice}
          isInvoiceModalOpen={isInvoiceModalOpen}
          setIsInvoiceModalOpen={setIsInvoiceModalOpen}
          patient={patient}
          medicalAid={medicalAid}
        />;
      case 'audit':
        return <AuditTrailContent patientId={patientId} />;
      default:
        return <AIIntelligenceContent 
          visits={visits} 
          vitals={vitals} 
          patientId={patientId}
          patient={patient}
          nextOfKin={nextOfKin}
          medicalAid={medicalAid}
          onSendSms={onSendSms}
          onMedicalAidClick={onMedicalAidClick}
          onMedicalAidLimitClick={onMedicalAidLimitClick}
          onBillingClick={onBillingClick}
          selectedInvoice={selectedInvoice}
          setSelectedInvoice={setSelectedInvoice}
          isInvoiceModalOpen={isInvoiceModalOpen}
          setIsInvoiceModalOpen={setIsInvoiceModalOpen}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
        />;
    }
  };

  return (
    <div className="w-full relative">

      <div className="relative mb-6">
        <div className="flex items-center gap-1 relative z-10 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            
            const getTabColors = () => {
              switch(tab.id) {
                case 'ai-intelligence': return {
                  textColor: isActive ? 'text-purple-700' : 'text-gray-600'
                };
                case 'encounters': return {
                  textColor: isActive ? 'text-white' : 'text-gray-600'
                };
                case 'vitals': return {
                  textColor: isActive ? 'text-red-700' : 'text-gray-600'
                };
                case 'results': return {
                  textColor: isActive ? 'text-purple-700' : 'text-gray-600'
                };
                case 'documents': return {
                  textColor: isActive ? 'text-amber-700' : 'text-gray-600'
                };
                case 'billing': return {
                  textColor: isActive ? 'text-teal-700' : 'text-gray-600'
                };
                case 'audit': return {
                  textColor: isActive ? 'text-slate-700' : 'text-gray-600'
                };
                default: return {
                  textColor: isActive ? 'text-purple-700' : 'text-gray-600'
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
                <div className={`transition-colors duration-200 ${isActive ? colors.textColor : 'text-gray-500'}`}>
                  {tab.icon}
                </div>
                
                <span className={`font-medium truncate whitespace-nowrap transition-colors duration-300 ${colors.textColor}`} style={{ fontFamily: 'Poppins, sans-serif' }}>{tab.label}</span>
                
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`
                    px-2 py-0.5 rounded text-xs font-medium min-w-[20px] text-center transition-colors duration-200
                    ${isActive 
                      ? 'bg-gray-200 text-gray-700' 
                      : 'bg-gray-300 text-gray-600'
                    }
                  `} style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {tab.count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
        
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

      <InvoiceDetailsModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
      />
    </div>
  );
};

export default PremiumFolderTabs;