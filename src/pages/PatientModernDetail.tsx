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
  Calendar
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
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm rounded-b-xl">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/patients')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              {patient && (
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden">
                    <img 
                      src="https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200"
                      alt={`${patient.first_name} ${patient.last_name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h1 className="text-[30px] font-bold text-[#494c61] flex items-center">
                      {patient.first_name} {patient.last_name}
                      <div className="flex items-center ml-4 space-x-2">
                        <Badge variant="success" size="sm">Active</Badge>
                        <Badge variant="azure" size="sm">Insured</Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowHealthSummary(true)}
                          className="ml-2"
                        >
                          <Brain size={14} className="mr-1" />
                          Health Summary
                        </Button>
                      </div>
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
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
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Patient Info */}
          <div className="lg:col-span-3 space-y-6">
            {/* Medical Aid Card */}
            <Card className="overflow-hidden border-l-4 border-l-[#01b9d4]">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <Building2 size={16} className="mr-2 text-[#01b9d4]" />
                    Medical Aid
                  </div>
                  <Button variant="ghost" size="sm">
                    <Edit3 size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-900">Discovery Health</p>
                      <p className="text-xs text-gray-500">Executive Plan</p>
                    </div>
                    <Badge variant="success" size="sm">Active</Badge>
                  </div>
                  
                  <div className="text-sm">
                    <p className="text-gray-500">Membership Number</p>
                    <p className="font-mono text-gray-700">DH123456789</p>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Main Member</p>
                    <p className="text-sm font-medium text-gray-900">John Smith</p>
                    <p className="text-xs text-gray-500">ID: 8001015012087</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next of Kin Card */}
            <Card className="overflow-hidden border-l-4 border-l-[#0197d4]">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <Heart size={16} className="mr-2 text-[#0197d4]" />
                    Next of Kin
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsNextOfKinModalOpen(true)}>
                    <Edit3 size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-rose-50 rounded-full">
                      <Heart size={16} className="text-rose-500" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-900">Sarah Smith</p>
                      <p className="text-xs text-gray-500">Spouse</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone size={14} className="mr-2 text-gray-400" />
                      <span>+1 234 567 8900</span>
                    </div>
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin size={14} className="mr-2 mt-1 text-gray-400" />
                      <span>123 Main Street, Anytown</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Visits Timeline */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Visit History</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search visits..."
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01b9d4]"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter size={14} className="mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200"></div>

              {visits.map((visit, index) => (
                <motion.div
                  key={visit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative bg-white rounded-xl border ${
                    visit.status === 'completed' ? 'border-emerald-200' :
                    visit.status === 'in-progress' ? 'border-amber-200' :
                    'border-gray-200'
                  } p-4 hover:shadow-md transition-shadow cursor-pointer ml-10`}
                  onClick={() => handleVisitClick(visit.id)}
                >
                  {/* Timeline node */}
                  <div className={`absolute -left-10 top-6 w-4 h-4 rounded-full border-2 ${
                    visit.status === 'completed' ? 'bg-emerald-500 border-emerald-200' :
                    visit.status === 'in-progress' ? 'bg-amber-500 border-amber-200' :
                    'bg-gray-500 border-gray-200'
                  }`} />

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">
                          {visit.visit_type} with {visit.doctor_name}
                        </h3>
                        <Badge variant={getStatusColor(visit.status)} size="sm">
                          {visit.status}
                        </Badge>
                      </div>
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <Calendar size={14} className="mr-2" />
                        {format(new Date(visit.visit_date), 'MMM d, yyyy')} at {visit.visit_time}
                      </div>
                      {visit.chief_complaint && (
                        <p className="mt-2 text-sm text-gray-600">
                          {visit.chief_complaint}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>

                  {/* Lab Results and Media */}
                  <div className="mt-3 flex items-center space-x-4">
                    <div className="flex items-center text-gray-500">
                      <Microscope size={14} className="mr-1" />
                      <span className="text-xs">2 Lab Results</span>
                    </div>
                    <div className="flex items-center text-gray-500">
                      <ImageIcon size={14} className="mr-1" />
                      <span className="text-xs">3 Media Files</span>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVisitStatusChange(visit.id, 'completed');
                      }}
                      className={visit.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : ''}
                    >
                      <CheckCircle2 size={14} className="mr-1" />
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
                      <Activity size={14} className="mr-1" />
                      In Progress
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column - Vitals */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center text-sm font-medium text-gray-700">
                  <Activity size={16} className="mr-2 text-[#01b9d4]" />
                  Latest Vitals
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">Blood Pressure</div>
                    <div className="text-base font-semibold text-gray-900">120/80</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">Temperature</div>
                    <div className="text-base font-semibold text-gray-900">36.5°C</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">Heart Rate</div>
                    <div className="text-base font-semibold text-gray-900">72 bpm</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">BMI</div>
                    <div className="text-base font-semibold text-gray-900">24.5</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional vitals or quick actions can go here */}
          </div>
        </div>
      </div>

      {/* Modals */}
      <FormModal
        isOpen={showHealthSummary}
        onClose={() => setShowHealthSummary(false)}
        title="Health Summary"
      >
        <div className="bg-gradient-to-r from-[#a855f7] to-[#00B4D8] p-6 rounded-xl text-white">
          {/* Health Summary Content */}
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

