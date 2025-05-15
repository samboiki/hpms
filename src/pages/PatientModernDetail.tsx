import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Pill,
  Plus,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { supabase } from '../lib/supabase';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  cellNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  homeLanguage: string;
  homeAddress: string;
  postalAddress: string;
  postalCode: string;
  medicalAidDetails: Array<{
    provider: string;
    scheme: string;
    membershipNumber: string;
    planType: string;
    mainMemberName: string;
    mainMemberIdNumber: string;
    relationshipToMain: string;
  }>;
  nextOfKin: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    address: string;
  }>;
  chronicConditions?: string[];
}

// Mock data for vitals chart
const vitalsData = [
  { date: '2024-01', systolic: 120, diastolic: 80, weight: 70 },
  { date: '2024-02', systolic: 118, diastolic: 78, weight: 69.5 },
  { date: '2024-03', systolic: 122, diastolic: 82, weight: 69.8 },
];

const PatientModernDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'vitals' | 'history'>('overview');

  useEffect(() => {
    if (id) {
      fetchPatientDetails();
    }
  }, [id]);

  const fetchPatientDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const transformedData = {
        ...data,
        firstName: data.first_name,
        lastName: data.last_name,
        cellNumber: data.cell_number,
        dateOfBirth: data.date_of_birth,
        maritalStatus: data.marital_status,
        homeLanguage: data.home_language,
        homeAddress: data.home_address,
        postalAddress: data.postal_address,
        postalCode: data.postal_code,
        medicalAidDetails: data.medical_aid_details?.map((detail: any) => ({
          provider: detail.provider,
          scheme: detail.scheme,
          membershipNumber: detail.membership_number,
          planType: detail.plan_type,
          mainMemberName: detail.main_member_name,
          mainMemberIdNumber: detail.main_member_id_number,
          relationshipToMain: detail.relationship_to_main
        })),
        nextOfKin: data.next_of_kin
      };

      setPatient(transformedData);
    } catch (err) {
      console.error('Error fetching patient details:', err);
      setError('Failed to load patient details');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-xl shadow-lg text-center"
        >
          <Loader2 size={32} className="animate-spin text-brand-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading patient details...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="text-center py-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-xl shadow-lg inline-block"
        >
          <AlertCircle size={48} className="text-error-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-error-600 mb-4">{error || 'Patient not found'}</h2>
          <Button variant="outline" onClick={() => navigate('/patients')}>
            <ChevronLeft size={16} className="mr-2" />
            Back to Patients
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/patients')}
                className="mr-4"
              >
                <ChevronLeft size={16} />
              </Button>
              <div>
                <h1 className="text-[30px] font-bold font-heading text-[#494c61]">
                  {patient.firstName} {patient.lastName}
                </h1>
                <p className="text-gray-600">
                  {calculateAge(patient.dateOfBirth)} years • {patient.gender} • ID: {patient.id}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
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

          {/* Navigation Tabs */}
          <div className="flex space-x-8 -mb-px">
            {(['overview', 'vitals', 'history'] as const).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`
                  pb-4 px-1 border-b-2 font-medium text-sm
                  ${activeSection === section
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'overview' && (
              <div className="grid grid-cols-12 gap-6">
                {/* Patient Info Card */}
                <Card className="col-span-12 md:col-span-4">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-16 bg-gradient-to-r from-brand-primary to-brand-600 rounded-full flex items-center justify-center">
                        <User size={32} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{patient.occupation || 'No occupation listed'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center text-gray-600">
                        <Phone size={16} className="mr-3 text-brand-primary" />
                        <span>{patient.cellNumber}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Mail size={16} className="mr-3 text-brand-primary" />
                        <span>{patient.email}</span>
                      </div>
                      <div className="flex items-start text-gray-600">
                        <MapPin size={16} className="mr-3 mt-1 text-brand-primary" />
                        <span>{patient.homeAddress}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Quick Stats</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-brand-primary">12</div>
                          <div className="text-xs text-gray-500">Visits</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-brand-primary">4</div>
                          <div className="text-xs text-gray-500">Reports</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-brand-primary">2</div>
                          <div className="text-xs text-gray-500">Referrals</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Medical Aid Card */}
                <Card className="col-span-12 md:col-span-4">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                    <CardTitle className="text-white flex items-center">
                      <Building2 size={20} className="mr-2" />
                      Medical Aid Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {patient.medicalAidDetails?.[0] ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-gray-500">Provider</label>
                          <p className="text-lg font-semibold text-gray-900">
                            {patient.medicalAidDetails[0].provider}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Scheme</label>
                          <p className="text-gray-900">{patient.medicalAidDetails[0].scheme}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Membership Number</label>
                          <p className="font-mono text-gray-900">
                            {patient.medicalAidDetails[0].membershipNumber}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit3 size={14} className="mr-2" />
                          Update Details
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No medical aid information</p>
                        <Button variant="outline" size="sm" className="mt-4">
                          Add Medical Aid
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Next of Kin Card */}
                <Card className="col-span-12 md:col-span-4">
                  <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
                    <CardTitle className="text-white flex items-center">
                      <Heart size={20} className="mr-2" />
                      Next of Kin
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {patient.nextOfKin?.[0] ? (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-rose-100 rounded-full">
                            <Heart size={20} className="text-rose-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{patient.nextOfKin[0].name}</h3>
                            <p className="text-sm text-gray-500">{patient.nextOfKin[0].relationship}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center text-gray-600">
                            <Phone size={16} className="mr-2" />
                            <span>{patient.nextOfKin[0].phone}</span>
                          </div>
                          {patient.nextOfKin[0].address && (
                            <div className="flex items-start text-gray-600">
                              <MapPin size={16} className="mr-2 mt-1" />
                              <span>{patient.nextOfKin[0].address}</span>
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit3 size={14} className="mr-2" />
                          Update Details
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Heart size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No next of kin information</p>
                        <Button variant="outline" size="sm" className="mt-4">
                          Add Next of Kin
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Insights Card */}
                <Card className="col-span-12">
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                          <Brain size={20} className="text-indigo-600" />
                        </div>
                        <CardTitle>AI Health Insights</CardTitle>
                      </div>
                      <div className="flex items-center text-xs text-indigo-600">
                        <Sparkles size={14} className="mr-1" />
                        AI Generated
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                          <Activity size={16} className="text-indigo-600 mr-2" />
                          Health Status
                        </h4>
                        <ul className="space-y-3">
                          <li className="flex items-center text-sm text-gray-600">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2" />
                            Regular check-ups maintained
                          </li>
                          <li className="flex items-center text-sm text-gray-600">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2" />
                            Up-to-date with vaccinations
                          </li>
                          <li className="flex items-center text-sm text-gray-600">
                            <div className="w-2 h-2 bg-amber-400 rounded-full mr-2" />
                            Blood pressure monitoring recommended
                          </li>
                        </ul>
                      </div>

                      <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-xl p-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                          <Stethoscope size={16} className="text-rose-600 mr-2" />
                          Recent Observations
                        </h4>
                        <ul className="space-y-3">
                          <li className="flex items-center text-sm text-gray-600">
                            <Clock size={14} className="text-rose-600 mr-2" />
                            Last visit: {format(new Date(), 'MMM d, yyyy')}
                          </li>
                          <li className="flex items-center text-sm text-gray-600">
                            <Pill size={14} className="text-rose-600 mr-2" />
                            Medication adherence: Good
                          </li>
                          <li className="flex items-center text-sm text-gray-600">
                            <Activity size={14} className="text-rose-600 mr-2" />
                            Vitals: Stable
                          </li>
                        </ul>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                          <ArrowRight size={16} className="text-emerald-600 mr-2" />
                          Recommendations
                        </h4>
                        <ul className="space-y-3">
                          <li className="flex items-center text-sm text-gray-600">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2" />
                            Schedule next check-up in 3 months
                          </li>
                          <li className="flex items-center text-sm text-gray-600">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2" />
                            Continue current medication regimen
                          </li>
                          <li className="flex items-center text-sm text-gray-600">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2" />
                            Maintain healthy lifestyle habits
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'vitals' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Vitals Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="systolic"
                            stroke="#0ea5e9"
                            name="Systolic BP"
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="diastolic"
                            stroke="#6366f1"
                            name="Diastolic BP"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="weight"
                            stroke="#10b981"
                            name="Weight"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Latest Blood Pressure</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">120/80</div>
                        <p className="text-sm text-gray-500 mt-1">mmHg</p>
                        <Badge variant="success" className="mt-2">Normal</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Latest Weight</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">69.8</div>
                        <p className="text-sm text-gray-500 mt-1">kg</p>
                        <Badge variant="success" className="mt-2">Healthy</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>BMI</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">22.4</div>
                        <p className="text-sm text-gray-500 mt-1">kg/m²</p>
                        <Badge variant="success" className="mt-2">Normal</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeSection === 'history' && (
              <div className="space-y-6">
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 md:col-span-8">
                    <Card>
                      <CardHeader>
                        <CardTitle>Visit History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {[1, 2, 3].map((visit) => (
                            <div
                              key={visit}
                              className="flex items-start space-x-4 p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                              <div className="p-2 bg-brand-50 rounded-lg">
                                <Stethoscope size={20} className="text-brand-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    Regular Check-up
                                  </h4>
                                  <Badge variant="glass">Completed</Badge>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                  Patient reported mild headaches. BP: 120/80, Temp: 36.6°C
                                </p>
                                <div className="mt-2 flex items-center text-xs text-gray-500">
                                  <Clock size={12} className="mr-1" />
                                  {format(new Date(), 'MMM d, yyyy')}
                                  <span className="mx-2">•</span>
                                  <User size={12} className="mr-1" />
                                  Dr. Sarah Johnson
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <ChevronRight size={16} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="col-span-12 md:col-span-4 space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Upcoming Appointments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-brand-50 border border-brand-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white rounded-lg">
                                  <Calendar size={20} className="text-brand-500" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900">
                                    Follow-up Visit
                                  </h4>
                                  <p className="text-xs text-gray-500">
                                    March 25, 2024 • 10:30 AM
                                  </p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <ChevronRight size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Documents</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {['Lab Results.pdf', 'Medical Certificate.pdf', 'Prescription.pdf'].map((doc) => (
                            <div
                              key={doc}
                              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <FileText size={16} className="text-gray-400" />
                                <span className="text-sm text-gray-900">{doc}</span>
                              </div>
                              <Button variant="ghost" size="sm">
                                <ChevronRight size={16} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PatientModernDetail;