import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Activity,
  Microscope,
  Image,
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Heart,
  Thermometer,
  Weight,
  Link2
} from 'lucide-react';
import { format } from 'date-fns';

interface Visit {
  id: string;
  appointment_id?: string;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  status: string;
  created_at: string;
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  doctor_name?: string;
  notes?: string;
}

interface Vital {
  id: string;
  visit_id?: string;
  blood_pressure?: string;
  temperature?: number;
  pulse_rate?: number;
  respiratory_rate?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  oxygen_saturation?: number;
  created_at: string;
}

interface LabRequest {
  id: string;
  visit_id?: string;
  test_name: string;
  status: string;
  priority: string;
  requested_date: string;
  results?: any;
}

interface MediaRequest {
  id: string;
  visit_id?: string;
  request_type: string;
  body_part?: string;
  status: string;
  requested_date: string;
  image_url?: string;
}

interface PatientDataTabsProps {
  patientId: string;
  visits: Visit[];
  appointments: Appointment[];
  vitals: Vital[];
  labRequests: LabRequest[];
  mediaRequests: MediaRequest[];
  onAddVital?: () => void;
  onAddLabRequest?: () => void;
  onAddMediaRequest?: () => void;
  onLinkToVisit?: (itemId: string, visitId: string, type: 'vital' | 'lab' | 'media') => void;
}

export default function PatientDataTabs({
  patientId,
  visits,
  appointments,
  vitals,
  labRequests,
  mediaRequests,
  onAddVital,
  onAddLabRequest,
  onAddMediaRequest,
  onLinkToVisit
}: PatientDataTabsProps) {
  const [activeTab, setActiveTab] = useState<'appointments' | 'vitals' | 'labs' | 'imaging'>('appointments');
  const [linkingMode, setLinkingMode] = useState<{ itemId: string; type: 'vital' | 'lab' | 'media' } | null>(null);

  const tabs = [
    { 
      id: 'appointments', 
      label: 'Appointments', 
      icon: Calendar, 
      count: appointments.length,
      color: 'from-blue-500 to-cyan-600'
    },
    { 
      id: 'vitals', 
      label: 'Vitals', 
      icon: Activity, 
      count: vitals.length,
      color: 'from-green-500 to-emerald-600'
    },
    { 
      id: 'labs', 
      label: 'Lab Results', 
      icon: Microscope, 
      count: labRequests.length,
      color: 'from-purple-500 to-indigo-600'
    },
    { 
      id: 'imaging', 
      label: 'Imaging', 
      icon: Image, 
      count: mediaRequests.length,
      color: 'from-amber-500 to-orange-600'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'scheduled': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-amber-600 bg-amber-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      case 'in-progress': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderAppointments = () => (
    <div className="space-y-3">
      {appointments.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No appointments recorded</p>
        </div>
      ) : (
        appointments.map((apt) => (
          <motion.div
            key={apt.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-sm">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{apt.type}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">
                      {format(new Date(apt.date), 'MMM d, yyyy')} at {apt.time}
                    </span>
                    {apt.doctor_name && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{apt.doctor_name}</span>
                      </>
                    )}
                  </div>
                  {apt.notes && (
                    <p className="text-sm text-gray-500 mt-2">{apt.notes}</p>
                  )}
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                {apt.status}
              </span>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  const renderVitals = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Vital Signs History</h3>
        {onAddVital && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddVital}
            className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Vitals
          </motion.button>
        )}
      </div>
      
      {vitals.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No vitals recorded</p>
        </div>
      ) : (
        vitals.map((vital) => (
          <motion.div
            key={vital.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">
                  {format(new Date(vital.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {vital.visit_id ? (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Linked to Visit
                </span>
              ) : onLinkToVisit && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setLinkingMode({ itemId: vital.id, type: 'vital' })}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  Link to Visit
                </motion.button>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vital.blood_pressure && (
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <div>
                    <p className="text-xs text-gray-500">BP</p>
                    <p className="text-sm font-medium">{vital.blood_pressure}</p>
                  </div>
                </div>
              )}
              {vital.pulse_rate && (
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500">Pulse</p>
                    <p className="text-sm font-medium">{vital.pulse_rate} bpm</p>
                  </div>
                </div>
              )}
              {vital.temperature && (
                <div className="flex items-center gap-2">
                  <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                  <div>
                    <p className="text-xs text-gray-500">Temp</p>
                    <p className="text-sm font-medium">{vital.temperature}°C</p>
                  </div>
                </div>
              )}
              {vital.weight && (
                <div className="flex items-center gap-2">
                  <Weight className="w-3.5 h-3.5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500">Weight</p>
                    <p className="text-sm font-medium">{vital.weight} kg</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  const renderLabs = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Laboratory Tests</h3>
        {onAddLabRequest && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddLabRequest}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Request Lab
          </motion.button>
        )}
      </div>
      
      {labRequests.length === 0 ? (
        <div className="text-center py-12">
          <Microscope className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No lab requests</p>
        </div>
      ) : (
        labRequests.map((lab) => (
          <motion.div
            key={lab.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm">
                  <Microscope className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{lab.test_name}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Requested on {format(new Date(lab.requested_date), 'MMM d, yyyy')}
                  </p>
                  {lab.results && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <p className="text-gray-700">{lab.results}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lab.status)}`}>
                  {lab.status}
                </span>
                {lab.visit_id ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked
                  </span>
                ) : onLinkToVisit && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setLinkingMode({ itemId: lab.id, type: 'lab' })}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    Link
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  const renderImaging = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Medical Imaging</h3>
        {onAddMediaRequest && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddMediaRequest}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Request Imaging
          </motion.button>
        )}
      </div>
      
      {mediaRequests.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No imaging requests</p>
        </div>
      ) : (
        mediaRequests.map((media) => (
          <motion.div
            key={media.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg shadow-sm">
                  <Image className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{media.request_type}</h4>
                  {media.body_part && (
                    <p className="text-sm text-gray-600">Body part: {media.body_part}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Requested on {format(new Date(media.requested_date), 'MMM d, yyyy')}
                  </p>
                  {media.image_url && (
                    <button className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      View Image
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(media.status)}`}>
                  {media.status}
                </span>
                {media.visit_id ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked
                  </span>
                ) : onLinkToVisit && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setLinkingMode({ itemId: media.id, type: 'media' })}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    Link
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/50 overflow-hidden">
      {/* Tab Headers */}
      <div className="flex items-center border-b border-gray-200 bg-gray-50/50">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 relative px-4 py-4 transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <tab.icon className={`w-4 h-4 ${
                activeTab === tab.id ? 'text-[#01b9d5]' : ''
              }`} />
              <span className="font-medium text-sm">{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </div>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tab.color}`}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'appointments' && renderAppointments()}
            {activeTab === 'vitals' && renderVitals()}
            {activeTab === 'labs' && renderLabs()}
            {activeTab === 'imaging' && renderImaging()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Linking Mode Modal */}
      {linkingMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Link to Visit</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a visit to link this {linkingMode.type} record to:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {visits.map((visit) => (
                <button
                  key={visit.id}
                  onClick={() => {
                    if (onLinkToVisit) {
                      onLinkToVisit(linkingMode.itemId, visit.id, linkingMode.type);
                    }
                    setLinkingMode(null);
                  }}
                  className="w-full p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <p className="font-medium text-gray-900">{visit.visit_type}</p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(visit.visit_date), 'MMM d, yyyy')} - {visit.chief_complaint || 'No complaint'}
                  </p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setLinkingMode(null)}
              className="mt-4 w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}