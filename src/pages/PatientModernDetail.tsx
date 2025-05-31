import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Heart,
  Activity,
  Brain,
  Stethoscope,
  Plus,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Edit3,
  ImageIcon,
  Microscope,
  ChevronRight,
  Clock,
  Calendar,
  FileText,
  Pill
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import VitalsDisplay from '../components/patients/VitalsDisplay';
import EditVisitForm from '../components/forms/EditVisitForm';
import VisitModal from '../components/visits/VisitModal';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  avatar?: string;
}

interface Visit {
  id: string;
  appointment_id?: string;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  status: string;
  doctor_name: string;
  chief_complaint: string;
  diagnosis: string;
  prescription?: string;
  vitals: {
    blood_pressure?: string;
    temperature?: number;
    pulse_rate?: number;
    respiratory_rate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PatientModernDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNextOfKinModalOpen, setIsNextOfKinModalOpen] = useState(false);
  const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);
  const [showHealthSummary, setShowHealthSummary] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isVisitDetailModalOpen, setIsVisitDetailModalOpen] = useState(false);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!id || !UUID_REGEX.test(id)) {
          throw new Error('Invalid patient ID format. Please use a valid UUID.');
        }
        
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (patientError) throw patientError;
        if (!patientData) throw new Error('Patient not found');
        
        setPatient(patientData);

        const { data: visitsData, error: visitsError } = await supabase
          .from('visit_details_view')
          .select('*')
          .eq('patient_id', id)
          .order('visit_date', { ascending: false });

        if (visitsError) throw visitsError;
        setVisits(visitsData || []);

      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while fetching patient data');
        if (error instanceof Error && error.message.includes('Invalid patient ID format')) {
          navigate('/patients');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, navigate]);

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'emerald';
      case 'in-progress':
        return 'amber';
      case 'cancelled':
        return 'rose';
      default:
        return 'glass';
    }
  };

  const handleVisitClick = async (visitId: string) => {
    try {
      const { data, error } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('id', visitId)
        .single();

      if (error) throw error;
      setSelectedVisit(data);
      setIsVisitDetailModalOpen(true);
    } catch (error) {
      console.error('Error fetching visit details:', error);
    }
  };

  const handleVisitStatusChange = async (visitId: string, status: string, appointmentId?: string) => {
    try {
      // Update visit status
      const { error: visitError } = await supabase
        .from('visits')
        .update({ status })
        .eq('id', visitId);

      if (visitError) throw visitError;

      // If completing a visit and it has an associated appointment, update the appointment too
      if (status === 'completed' && appointmentId) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', appointmentId);

        if (appointmentError) throw appointmentError;
      }

      const { data: updatedVisits } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false });

      setVisits(updatedVisits || []);
    } catch (error) {
      console.error('Error updating visit status:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/patients')}
          variant="outline"
          className="mt-4"
        >
          <ChevronLeft size={16} className="mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50/80 to-blue-50/20">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Modern Header */}
        <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50">
          <div className="p-4 md:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/patients')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </motion.button>
                
                {patient && (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full overflow-hidden border-4 border-[#01b9d5]/20">
                        <img 
                          src="https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200"
                          alt={`${patient.first_name} ${patient.last_name}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold text-gray-800">
                          {patient.first_name} {patient.last_name}
                        </h1>
                        <div className="flex items-center gap-2">
                          <Badge variant="emerald" size="sm">Active</Badge>
                          <Badge variant="azure" size="sm">Insured</Badge>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          {patient.cell_number}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {patient.email}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          Age {calculateAge(patient.date_of_birth)} • {patient.gender}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowHealthSummary(true)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-all duration-300 text-sm"
                >
                  <Brain className="w-4 h-4" />
                  Health Summary
                </motion.button>
          
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddVisitModalOpen(true)}
                  className="bg-[#01b9d5] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:shadow-lg hover:shadow-[#01b9d5]/20 transition-all duration-200 font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Visit
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
          {/* Medical Aid Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-[#01b9d4] to-purple-600"></div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#01b9d4]" />
                  Medical Aid
                </h3>
                <button className="text-[#01b9d5] hover:text-[#01a3c7] p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">Discovery Health</p>
                    <p className="text-sm text-gray-500">Executive Plan</p>
                  </div>
                  <Badge variant="emerald" size="sm">Active</Badge>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Membership Number</p>
                  <p className="font-mono text-gray-700 font-medium">DH123456789</p>
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Main Member</p>
                  <p className="text-sm font-medium text-gray-900">John Smith</p>
                  <p className="text-xs text-gray-500">ID: 8001015012087</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Next of Kin Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-red-500 to-pink-600"></div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Next of Kin
                </h3>
                <button 
                  onClick={() => setIsNextOfKinModalOpen(true)}
                  className="text-[#01b9d5] hover:text-[#01a3c7] p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Sarah Smith</p>
                    <p className="text-sm text-gray-500">Spouse</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="w-4 h-4 text-[#01b9d5]" />
                    <span className="text-sm text-gray-700">+1 234 567 8900</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-4 h-4 text-[#01b9d5] mt-0.5" />
                    <span className="text-sm text-gray-700">123 Main Street, Anytown</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

          {/* Main Content - Visit History */}
          <div className="lg:col-span-6 space-y-4 md:space-y-6">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#01b9d5]" />
                Visit History
                <span className="text-sm font-normal text-gray-500">({visits.length} visits)</span>
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search visits..."
                    className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                </motion.button>
              </div>
            </div>

            <div className="relative space-y-4">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

              {visits.map((visit, index) => (
                <motion.div
                  key={visit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative bg-gray-50 rounded-xl border-2 ${
                    visit.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' :
                    visit.status === 'in-progress' ? 'border-amber-200 bg-amber-50/50' :
                    'border-gray-200'
                  } p-5 hover:shadow-lg hover:bg-white transition-all duration-300 cursor-pointer ml-10`}
                  onClick={() => handleVisitClick(visit.id)}
                >
                  <div className={`absolute -left-10 top-6 w-5 h-5 rounded-full border-4 border-white shadow-sm ${
                    visit.status === 'completed' ? 'bg-emerald-500' :
                    visit.status === 'in-progress' ? 'bg-amber-500' :
                    'bg-gray-400'
                  }`} />

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {visit.visit_type} with {visit.doctor_name}
                        </h3>
                        <Badge variant={getStatusColor(visit.status)} size="sm">
                          {visit.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(visit.visit_date), 'MMM d, yyyy')} at {visit.visit_time}
                      </div>
                      
                      {visit.chief_complaint && (
                        <p className="text-sm text-gray-600 bg-white/70 p-3 rounded-lg">
                          <span className="font-medium">Chief Complaint:</span> {visit.chief_complaint}
                        </p>
                      )}
                    </div>
                    
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="p-2 hover:bg-white/70 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </motion.div>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-500 bg-white/70 px-2 py-1 rounded-full">
                      <Microscope className="w-4 h-4" />
                      <span className="text-xs font-medium">2 Lab Results</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 bg-white/70 px-2 py-1 rounded-full">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-xs font-medium">3 Media Files</span>
                    </div>
                    {visit.diagnosis && (
                      <div className="flex items-center gap-1 text-gray-500 bg-white/70 px-2 py-1 rounded-full">
                        <Stethoscope className="w-4 h-4" />
                        <span className="text-xs font-medium">Diagnosis</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    {visit.status === 'in-progress' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVisitStatusChange(visit.id, 'completed', visit.appointment_id);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        End Visit
                      </motion.button>
                    )}
                    {visit.status === 'scheduled' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVisitStatusChange(visit.id, 'in-progress', visit.appointment_id);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
                      >
                        <Activity className="w-4 h-4" />
                        Start Visit
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {visits.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No visits recorded yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "New Visit" to record the first visit</p>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* Right Sidebar - Vitals */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <VitalsDisplay vitals={visits[0]?.vitals || {}} />
          </motion.div>
          
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-[#01b9d5]" />
              Quick Actions
            </h3>
            
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
              >
                <FileText className="w-5 h-5 text-[#01b9d5]" />
                <div>
                  <p className="font-medium text-gray-900">View Records</p>
                  <p className="text-xs text-gray-500">Medical history & documents</p>
                </div>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
              >
                <Calendar className="w-5 h-5 text-[#01b9d5]" />
                <div>
                  <p className="font-medium text-gray-900">Schedule Appointment</p>
                  <p className="text-xs text-gray-500">Book follow-up visit</p>
                </div>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
              >
                <Pill className="w-5 h-5 text-[#01b9d5]" />
                <div>
                  <p className="font-medium text-gray-900">Prescriptions</p>
                  <p className="text-xs text-gray-500">View & manage medications</p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      <FormModal
        isOpen={isVisitDetailModalOpen}
        onClose={() => {
          setIsVisitDetailModalOpen(false);
          setSelectedVisit(null);
        }}
        title="Visit Details"
        hideHeader
      >
        {selectedVisit && (
          <VisitModal
            visit={selectedVisit}
            onClose={() => {
              setIsVisitDetailModalOpen(false);
              setSelectedVisit(null);
            }}
            onStatusChange={(status) => {
              handleVisitStatusChange(selectedVisit.id, status, selectedVisit.appointment_id);
            }}
            onEdit={() => {
              setIsVisitDetailModalOpen(false);
              setIsEditVisitModalOpen(true);
            }}
          />
        )}
      </FormModal>

      <FormModal
        isOpen={isEditVisitModalOpen}
        onClose={() => {
          setIsEditVisitModalOpen(false);
          setSelectedVisit(null);
        }}
        title="Edit Visit"
      >
        {selectedVisit && (
          <EditVisitForm
            visitId={selectedVisit.id}
            initialData={selectedVisit}
            onSuccess={() => {
              setIsEditVisitModalOpen(false);
              if (id) {
                const fetchVisits = async () => {
                  const { data } = await supabase
                    .from('visit_details_view')
                    .select('*')
                    .eq('patient_id', id)
                    .order('visit_date', { ascending: false });
                  setVisits(data || []);
                };
                fetchVisits();
              }
            }}
          />
        )}
      </FormModal>

      <FormModal
        isOpen={showHealthSummary}
        onClose={() => setShowHealthSummary(false)}
        title="Health Summary"
        className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <div className="bg-gradient-to-r from-[#a855f7] to-[#00B4D8] p-6 rounded-xl text-white">
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Patient Overview</h3>
              <p className="text-white/90">
                {patient?.first_name} {patient?.last_name} is a {calculateAge(patient?.date_of_birth || '')} year old patient with a history of regular check-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <CheckCircle2 size={16} className="mr-2" />
                    Last visit: {format(new Date(), 'MMM d, yyyy')}
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={16} className="mr-2" />
                    Vitals: Normal range
                  </li>
                </ul>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <ArrowRight size={16} className="mr-2" />
                    Schedule follow-up in 3 months
                  </li>
                  <li className="flex items-center">
                    <ArrowRight size={16} className="mr-2" />
                    Continue current treatment plan
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </FormModal>

      <FormModal
        isOpen={isNextOfKinModalOpen}
        onClose={() => setIsNextOfKinModalOpen(false)}
        title="Update Next of Kin"
      >
        <NextOfKinForm
          patientId={id || ''}
          onSuccess={() => setIsNextOfKinModalOpen(false)}
        />
      </FormModal>

      <FormModal
        isOpen={isAddVisitModalOpen}
        onClose={() => setIsAddVisitModalOpen(false)}
        title="Record New Visit"
      >
        <AddVisitForm
          patientId={id || ''}
          onSuccess={() => {
            setIsAddVisitModalOpen(false);
            if (id) {
              const fetchVisits = async () => {
                const { data } = await supabase
                  .from('visit_details_view')
                  .select('*')
                  .eq('patient_id', id)
                  .order('visit_date', { ascending: false });
                setVisits(data || []);
              };
              fetchVisits();
            }
          }}
        />
      </FormModal>
      </div>
    </div>
  );
};

export default PatientModernDetail;
