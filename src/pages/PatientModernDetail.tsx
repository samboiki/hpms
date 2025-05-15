import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Heart,
  Activity,
  Brain,
  Stethoscope,
  Pill,
  Plus,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
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
                  <h1 className="text-[30px] font-bold text-[#494c61]">
                    {patient.first_name} {patient.last_name}
                  </h1>
                  <p className="text-gray-500">
                    {calculateAge(patient.date_of_birth)} years • {patient.gender}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline">
                <FileText size={16} className="mr-2" />
                Export Data
              </Button>
              <Button>
                <Plus size={16} className="mr-2" />
                New Visit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Patient Info */}
          <div className="col-span-3 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User size={40} className="text-white" />
                  </div>
                  
                  <div className="mt-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Badge variant="success">Active</Badge>
                      <Badge variant="azure">Insured</Badge>
                    </div>
                  </div>

                  <div className="w-full mt-6 space-y-4">
                    <div className="flex items-center text-gray-600">
                      <Phone size={16} className="mr-3" />
                      <span>{patient?.cell_number}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Mail size={16} className="mr-3" />
                      <span>{patient?.email}</span>
                    </div>
                    <div className="flex items-start text-gray-600">
                      <MapPin size={16} className="mr-3 mt-1 flex-shrink-0" />
                      <span className="text-sm">123 Main Street, Anytown, ST 12345</span>
                    </div>
                  </div>

                  <div className="w-full mt-6 pt-6 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary-600">12</div>
                        <div className="text-xs text-gray-500">Visits</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary-600">4</div>
                        <div className="text-xs text-gray-500">Reports</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary-600">2</div>
                        <div className="text-xs text-gray-500">Referrals</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar size={16} className="mr-2" />
                    Schedule Appointment
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText size={16} className="mr-2" />
                    Add Medical Record
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Pill size={16} className="mr-2" />
                    Prescribe Medication
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Visits Timeline */}
          <div className="col-span-6 space-y-6">
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
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
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
                    <Badge variant={getStatusColor(visit.status)}>
                      {visit.status}
                    </Badge>
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

                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm">
                      View Details
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column - Vitals & Stats */}
          <div className="col-span-3 space-y-6">
            {/* Latest Vitals */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Heart size={16} className="mr-2 text-rose-500" />
                  Latest Vitals
                </h3>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Blood Pressure</div>
                    <div className="text-lg font-semibold">120/80</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Temperature</div>
                    <div className="text-lg font-semibold">37.2°C</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Heart Rate</div>
                    <div className="text-lg font-semibold">72 bpm</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Weight</div>
                    <div className="text-lg font-semibold">75 kg</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Indicators */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Activity size={16} className="mr-2 text-emerald-500" />
                  Health Indicators
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CheckCircle2 size={16} className="text-emerald-500 mr-2" />
                      <span className="text-sm text-gray-600">Vaccinations</span>
                    </div>
                    <Badge variant="success">Up to date</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AlertCircle size={16} className="text-amber-500 mr-2" />
                      <span className="text-sm text-gray-600">Allergies</span>
                    </div>
                    <Badge variant="warning">2 Known</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Brain size={16} className="text-purple-500 mr-2" />
                      <span className="text-sm text-gray-600">Mental Health</span>
                    </div>
                    <Badge variant="glass">Good</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar size={16} className="mr-2 text-blue-500" />
                  Upcoming Appointments
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Follow-up Visit</span>
                      <Badge variant="azure">Confirmed</Badge>
                    </div>
                    <p className="text-sm text-gray-500">Tomorrow at 10:30 AM</p>
                    <p className="text-sm text-gray-500">Dr. Sarah Johnson</p>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    View All Appointments
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientModernDetail;