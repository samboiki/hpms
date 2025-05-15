import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Star,
  Video,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  Heart,
  Stethoscope,
  Pill,
  Brain
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
  const [selectedFilter, setSelectedFilter] = useState('all');

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

        // Fetch visits
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select(`
            *,
            vitals (*)
          `)
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gray-50"
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
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
            <div className="flex items-center space-x-4">
              <Button variant="outline">
                <FileText size={16} className="mr-2" />
                Export Data
              </Button>
              <Button>
                <Clock size={16} className="mr-2" />
                New Visit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Sidebar - Patient Info */}
          <div className="col-span-3">
            <div className="space-y-6">
              {/* Patient Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center">
                    {patient?.avatar ? (
                      <img
                        src={patient.avatar}
                        alt={`${patient.first_name} ${patient.last_name}`}
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <User size={40} className="text-white" />
                      </div>
                    )}
                    
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
                        <MapPin size={16} className="mr-3 mt-1" />
                        <span>123 Main Street, Anytown, ST 12345</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vitals Summary */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Heart size={16} className="mr-2 text-rose-500" />
                    Latest Vitals
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* Main Content */}
          <div className="col-span-9 space-y-6">
            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant={selectedFilter === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={selectedFilter === 'visits' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('visits')}
                >
                  Visits
                </Button>
                <Button
                  variant={selectedFilter === 'labs' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('labs')}
                >
                  Lab Results
                </Button>
                <Button
                  variant={selectedFilter === 'prescriptions' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter('prescriptions')}
                >
                  Prescriptions
                </Button>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter size={16} className="mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            {/* Visit Timeline */}
            <div className="space-y-4">
              {visits.map((visit) => (
                <motion.div
                  key={visit.id}
                  variants={itemVariants}
                  className="bg-white rounded-xl border border-gray-200 p-6"
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
        </div>
      </div>
    </motion.div>
  );
};

export default PatientModernDetail;