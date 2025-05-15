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
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import AddVisitForm from '../components/forms/AddVisitForm';

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
  visit_date: string;
  visit_time: string;
  visit_type: string;
  status: string;
  doctor_name: string;
  chief_complaint: string;
  diagnosis: string;
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

const PatientModernDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNextOfKinModalOpen, setIsNextOfKinModalOpen] = useState(false);
  const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);
  const [showHealthSummary, setShowHealthSummary] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch patient details
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (patientError) throw patientError;
        setPatient(patientData);

        // Fetch visits with vitals
        const { data: visitsData, error: visitsError } = await supabase
          .from('visit_details_view')
          .select('*')
          .eq('patient_id', id)
          .order('visit_date', { ascending: false });

        if (visitsError) throw visitsError;
        setVisits(visitsData || []);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'glass';
    }
  };

  const handleVisitClick = (visitId: string) => {
    console.log('Visit clicked:', visitId);
  };

  const handleVisitStatusChange = async (visitId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ status })
        .eq('id', visitId);

      if (error) throw error;

      // Refresh visits
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/patients')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              {patient && (
                <div>
                  <h1 className="text-[30px] font-bold text-[#494c61] flex items-center">
                    {patient.first_name} {patient.last_name}
                    <div className="flex items-center ml-4 space-x-2">
                      <Badge variant="success">Active</Badge>
                      <Badge variant="azure">Insured</Badge>
                    </div>
                  </h1>
                  <div className="flex items-center space-x-6 text-sm text-gray-500 mt-1">
                    <div className="flex items-center">
                      <Phone size={14} className="mr-2" />
                      {patient.cell_number}
                    </div>
                    <div className="flex items-center">
                      <Mail size={14} className="mr-2" />
                      {patient.email}
                    </div>
                    <div className="flex items-center">
                      <MapPin size={14} className="mr-2" />
                      123 Main Street, Anytown
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={() => setIsAddVisitModalOpen(true)}
              style={{ backgroundColor: '#01b9d4' }}
              className="text-white hover:bg-opacity-90"
            >
              <Plus size={16} className="mr-2" />
              New Visit
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Patient Info */}
          <div className="col-span-3 space-y-6">
            {/* Medical Aid Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white flex items-center">
                    <Building2 size={20} className="mr-2" />
                    Medical Aid
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-white">
                    <Edit3 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Provider</h4>
                      <p className="text-lg font-semibold text-gray-900">Discovery Health</p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Scheme</h4>
                    <p className="text-gray-900">Executive Plan</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Membership Number</h4>
                    <p className="text-gray-900 font-mono">DH123456789</p>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500">Main Member</h4>
                    <p className="text-gray-900 font-medium">John Smith</p>
                    <p className="text-sm text-gray-500">ID: 8001015012087</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next of Kin Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white flex items-center">
                    <Heart size={20} className="mr-2" />
                    Next of Kin
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white"
                    onClick={() => setIsNextOfKinModalOpen(true)}
                  >
                    <Edit3 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-rose-100 rounded-full">
                      <Heart size={20} className="text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Sarah Smith</h3>
                      <p className="text-sm text-gray-500">Spouse</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-600">
                      <Phone size={16} className="mr-2" />
                      <span>+1 234 567 8900</span>
                    </div>
                    <div className="flex items-start text-gray-600">
                      <MapPin size={16} className="mr-2 mt-1" />
                      <span>123 Main Street, Anytown, ST 12345</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Summary Button */}
            <Button
              className="w-full bg-gradient-to-r from-[#a855f7] to-[#00B4D8] text-white"
              onClick={() => setShowHealthSummary(true)}
            >
              <Brain size={16} className="mr-2" />
              View Health Summary
            </Button>
          </div>

          {/* Middle Column - Visits Timeline */}
          <div className="col-span-9 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Visit History</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search visits..."
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter size={16} className="mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {visits.map((visit) => (
                <motion.div
                  key={visit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleVisitClick(visit.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-full bg-${getStatusColor(visit.status)}-100`}>
                        <Stethoscope size={20} className={`text-${getStatusColor(visit.status)}-500`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {visit.visit_type} with {visit.doctor_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {format(new Date(visit.visit_date), 'MMM d, yyyy')} at {visit.visit_time}
                        </p>
                        {visit.chief_complaint && (
                          <p className="mt-2 text-sm text-gray-600">
                            {visit.chief_complaint}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusColor(visit.status)}>
                        {visit.status}
                      </Badge>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>

                  {/* Lab Results and Media */}
                  <div className="mt-4 flex items-center space-x-4">
                    <div className="flex items-center text-gray-500">
                      <Microscope size={16} className="mr-1" />
                      <span className="text-sm">2 Lab Results</span>
                    </div>
                    <div className="flex items-center text-gray-500">
                      <ImageIcon size={16} className="mr-1" />
                      <span className="text-sm">3 Media Files</span>
                    </div>
                  </div>

                  {visit.vitals && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-4 gap-4">
                        {visit.vitals.blood_pressure && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Blood Pressure</div>
                            <div className="text-lg font-semibold">{visit.vitals.blood_pressure}</div>
                          </div>
                        )}
                        {visit.vitals.temperature && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Temperature</div>
                            <div className="text-lg font-semibold">{visit.vitals.temperature}°C</div>
                          </div>
                        )}
                        {visit.vitals.pulse_rate && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Heart Rate</div>
                            <div className="text-lg font-semibold">{visit.vitals.pulse_rate} bpm</div>
                          </div>
                        )}
                        {visit.vitals.weight && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Weight</div>
                            <div className="text-lg font-semibold">{visit.vitals.weight} kg</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVisitStatusChange(visit.id, 'completed');
                      }}
                      className={visit.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : ''}
                    >
                      <CheckCircle2 size={16} className="mr-2" />
                      Complete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVisitStatusChange(visit.id, 'in-progress');
                      }}
                      className={visit.status === 'in-progress' ? 'bg-amber-50 text-amber-600' : ''}
                    >
                      <Activity size={16} className="mr-2" />
                      In Progress
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
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
            // Refresh visits
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
  );
};

export default PatientModernDetail;