import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  ChevronLeft,
  Edit3,
  Clock,
  User,
  Loader2,
  Heart,
  Activity,
  Stethoscope,
  Pill,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Brain,
  Sparkles,
  Calendar
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddMedicalRecordForm from '../components/forms/AddMedicalRecordForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import { usePatient, calculateAge } from '../hooks/usePatient';
import { format } from 'date-fns';
import VisitsTimeline from '../components/visits/VisitsTimeline';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';

type ModalType = 'addRecord' | 'nextOfKin' | 'editPatient' | 'medicalAid' | 'addVisit' | null;

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = React.useState<ModalType>(null);
  
  const { 
    data: patient,
    isLoading,
    error,
    refetch
  } = usePatient(id || '');

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  const generateAISummary = (patient: any) => {
    if (!patient) return null;

    const age = calculateAge(patient.date_of_birth);
    const medicalAid = patient.medical_aid_details?.[0];
    const nextOfKin = patient.next_of_kin?.[0];

    return (
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
          <div className="prose prose-indigo">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="text-lg font-medium text-gray-900 mb-2">Patient Overview</h4>
              <p className="text-gray-600 leading-relaxed">
                {patient.first_name} {patient.last_name} is a {age}-year-old {patient.gender} 
                who is currently {patient.occupation ? `employed as a ${patient.occupation}` : 'employed'}.
                {medicalAid ? ` The patient is covered under ${medicalAid.provider} medical aid scheme.` : ''}
                {nextOfKin ? ` Emergency contact is ${nextOfKin.name} (${nextOfKin.relationship}).` : ''}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <Activity size={16} className="text-indigo-600 mr-2" />
                  Health Status
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-emerald-500 mr-2" />
                    Regular check-ups maintained
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-emerald-500 mr-2" />
                    Up-to-date with vaccinations
                  </li>
                  {patient.chronicConditions?.length > 0 && (
                    <li className="flex items-center">
                      <AlertCircle size={14} className="text-amber-500 mr-2" />
                      Managing {patient.chronicConditions.join(', ')}
                    </li>
                  )}
                </ul>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <Stethoscope size={16} className="text-indigo-600 mr-2" />
                  Recent Observations
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <Clock size={14} className="text-indigo-600 mr-2" />
                    Last visit: {format(new Date(), 'MMM d, yyyy')}
                  </li>
                  <li className="flex items-center">
                    <Pill size={14} className="text-indigo-600 mr-2" />
                    Medication adherence: Good
                  </li>
                  <li className="flex items-center">
                    <Activity size={14} className="text-indigo-600 mr-2" />
                    Vitals: Stable
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <Clipboard size={16} className="text-indigo-600 mr-2" />
                Recommendations
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <ArrowRight size={14} className="text-indigo-600 mr-2" />
                  Schedule next check-up in 3 months
                </li>
                <li className="flex items-center">
                  <ArrowRight size={14} className="text-indigo-600 mr-2" />
                  Monitor blood pressure regularly
                </li>
                <li className="flex items-center">
                  <ArrowRight size={14} className="text-indigo-600 mr-2" />
                  Continue current medication regimen
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-xl shadow-lg text-center"
        >
          <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-4" />
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
          <Button 
            variant="outline" 
            onClick={() => navigate('/patients')}
          >
            <ChevronLeft size={16} className="mr-2" />
            Back to Patients
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-6">
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
              Patient Details
            </h1>
            <p className="text-gray-600">View and manage patient information</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <FileText size={16} className="mr-2" />
            Export Data
          </Button>
          <Button onClick={() => setActiveModal('addVisit')}>
            <Clock size={16} className="mr-2" />
            Record Visit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-1 space-y-6 sticky top-24 self-start"
        >
          <Card className="overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-brand-500 to-brand-600" />
            <CardContent className="relative pt-16 pb-6">
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg">
                  <div className="w-full h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full flex items-center justify-center">
                    <User size={40} className="text-white" />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {patient.first_name} {patient.last_name}
                </h2>
                <time dateTime={patient.date_of_birth} className="text-gray-500 mt-1 block">
                  {calculateAge(patient.date_of_birth)} years • {patient.gender}
                </time>
                
                <div className="flex justify-center mt-3 space-x-2">
                  <Badge variant="success">Active Patient</Badge>
                  {patient.medical_aid_details && (
                    <Badge variant="azure">Insured</Badge>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center text-gray-600">
                    <Phone size={16} className="text-brand-500 mr-3" aria-hidden="true" />
                    <span>{patient.cell_number || 'No phone number'}</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-600">
                    <Mail size={16} className="text-brand-500 mr-3" aria-hidden="true" />
                    <span>{patient.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-600">
                    <MapPin size={16} className="text-brand-500 mr-3" aria-hidden="true" />
                    <span>{patient.home_address || 'No address'}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-brand-500">12</div>
                    <div className="text-xs text-gray-500">Visits</div>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <div className="text-2xl font-bold text-brand-500">4</div>
                    <div className="text-xs text-gray-500">Reports</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-brand-500">2</div>
                    <div className="text-xs text-gray-500">Referrals</div>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="mt-6 w-full"
                  onClick={() => setActiveModal('editPatient')}
                  aria-label="Edit patient profile"
                >
                  <Edit3 size={16} className="mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center">
                  <Building2 size={20} className="mr-2" />
                  Medical Aid
                </CardTitle>
                {patient.medical_aid_details && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white"
                    onClick={() => setActiveModal('medicalAid')}
                    aria-label="Edit medical aid details"
                  >
                    <Edit3 size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {patient.medical_aid_details && patient.medical_aid_details[0] ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Provider</h4>
                      <p className="text-lg font-semibold text-gray-900">{patient.medical_aid_details[0].provider}</p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Scheme</h4>
                    <p className="text-gray-900">{patient.medical_aid_details[0].scheme}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Membership Number</h4>
                    <p className="text-gray-900 font-mono">{patient.medical_aid_details[0].membership_number}</p>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500">Main Member</h4>
                    <p className="text-gray-900 font-medium">{patient.medical_aid_details[0].main_member_name}</p>
                    <p className="text-sm text-gray-500">ID: {patient.medical_aid_details[0].main_member_id_number}</p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4"
                    onClick={() => setActiveModal('medicalAid')}
                    aria-label="Update medical aid details"
                  >
                    <Edit3 size={14} className="mr-2" />
                    Update Details
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Building2 size={40} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
                  <p className="text-gray-500 mb-4">No medical aid information</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveModal('medicalAid')}
                    aria-label="Add medical aid information"
                  >
                    <Edit3 size={14} className="mr-2" />
                    Add Medical Aid
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center">
                  <Heart size={20} className="mr-2" />
                  Next of Kin
                </CardTitle>
                {patient.next_of_kin && patient.next_of_kin[0] && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white"
                    onClick={() => setActiveModal('nextOfKin')}
                    aria-label="Edit next of kin details"
                  >
                    <Edit3 size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {patient.next_of_kin && patient.next_of_kin[0] ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-rose-100 rounded-full">
                      <Heart size={20} className="text-rose-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{patient.next_of_kin[0].name}</h3>
                      <p className="text-sm text-gray-500">{patient.next_of_kin[0].relationship}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-600">
                      <Phone size={16} className="mr-2" aria-hidden="true" />
                      <span>{patient.next_of_kin[0].phone}</span>
                    </div>
                    
                    {patient.next_of_kin[0].address && (
                      <div className="flex items-start text-gray-600">
                        <MapPin size={16} className="mr-2 mt-1" aria-hidden="true" />
                        <span>{patient.next_of_kin[0].address}</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4"
                    onClick={() => setActiveModal('nextOfKin')}
                    aria-label="Update next of kin information"
                  >
                    <Edit3 size={14} className="mr-2" />
                    Update Information
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Heart size={40} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
                  <p className="text-gray-500 mb-4">No next of kin information</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveModal('nextOfKin')}
                    aria-label="Add next of kin"
                  >
                    <Edit3 size={14} className="mr-2" />
                    Add Next of Kin
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="lg:col-span-2 space-y-6"
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {generateAISummary(patient)}
            </TabsContent>

            <TabsContent value="history">
              <VisitsTimeline patientId={id || ''} />
            </TabsContent>

            <TabsContent value="appointments">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Appointments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No upcoming appointments</p>
                    <Button variant="outline" size="sm" className="mt-4">
                      Schedule Appointment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <FormModal
        isOpen={activeModal === 'addRecord'}
        onClose={() => setActiveModal(null)}
        title="Add Medical Record"
      >
        <AddMedicalRecordForm
          patientId={id || ''}
          onSuccess={() => {
            setActiveModal(null);
            refetch();
          }}
        />
      </FormModal>

      <FormModal
        isOpen={activeModal === 'nextOfKin'}
        onClose={() => setActiveModal(null)}
        title={patient.next_of_kin && patient.next_of_kin[0] ? "Update Next of Kin" : "Add Next of Kin"}
      >
        <NextOfKinForm
          patientId={id || ''}
          initialData={patient.next_of_kin && patient.next_of_kin[0]}
          onSuccess={() => {
            setActiveModal(null);
            refetch();
          }}
        />
      </FormModal>

      <FormModal
        isOpen={activeModal === 'editPatient'}
        onClose={() => setActiveModal(null)}
        title="Edit Patient Details"
      >
        <EditPatientForm
          patientId={id || ''}
          initialData={patient}
          onSuccess={() => {
            setActiveModal(null);
            refetch();
          }}
        />
      </FormModal>

      <FormModal
        isOpen={activeModal === 'addVisit'}
        onClose={() => setActiveModal(null)}
        title="Record New Visit"
      >
        <AddVisitForm
          patientId={id || ''}
          onSuccess={() => {
            setActiveModal(null);
            refetch();
          }}
        />
      </FormModal>
    </motion.div>
  );
};

export default PatientDetail;