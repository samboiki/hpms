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
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
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
              onClick={() => {}}
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
          <div className="col-span-3">
            <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                      <Brain size={20} className="text-indigo-600" />
                    </div>
                    <CardTitle>AI Health Summary</CardTitle>
                  </div>
                  <div className="flex items-center text-xs text-indigo-600">
                    <Sparkles size={14} className="mr-1" />
                    AI Generated
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Patient Overview</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {patient?.first_name} {patient?.last_name} is a {calculateAge(patient?.date_of_birth || '')} year old {patient?.gender}.
                    Regular check-ups are maintained and vitals are stable. Last visit was on {format(new Date(), 'MMMM d, yyyy')}.
                  </p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Health Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <CheckCircle2 size={14} className="text-emerald-500 mr-2" />
                      <span className="text-gray-600">Regular check-ups maintained</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <CheckCircle2 size={14} className="text-emerald-500 mr-2" />
                      <span className="text-gray-600">Up-to-date with vaccinations</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Activity size={14} className="text-indigo-600 mr-2" />
                      <span className="text-gray-600">Vitals within normal range</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Recommendations</h4>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <ArrowRight size={14} className="text-indigo-600 mr-2" />
                      <span className="text-gray-600">Schedule next check-up in 3 months</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <ArrowRight size={14} className="text-indigo-600 mr-2" />
                      <span className="text-gray-600">Monitor blood pressure regularly</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <ArrowRight size={14} className="text-indigo-600 mr-2" />
                      <span className="text-gray-600">Continue current medication regimen</span>
                    </div>
                  </div>
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