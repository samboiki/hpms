// src/pages/PatientDetail.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, differenceInYears } from 'date-fns';
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
  ArrowRight,
  Brain,
  Sparkles,
  CalendarDays,
  Briefcase,
  Home,
  Users,
  ShieldCheck,
  FilePlus,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import { supabase, logDatabaseError } from '../lib/supabase';
import VisitsTimeline from '../components/visits/VisitsTimeline';

interface MedicalAidDetail {
  provider: string;
  scheme: string;
  membershipNumber: string;
  planType: string;
  mainMemberName: string;
  mainMemberIdNumber: string;
  relationship: string;
}

interface NextOfKinDetail {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  occupation?: string;
  home_address: string;
  medical_aid_details?: MedicalAidDetail[];
  next_of_kin?: NextOfKinDetail[];
  chronicConditions?: string[];
  totalVisits?: number;
  totalReports?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 12 } },
};

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [nextOfKinOpen, setNextOfKinOpen] = useState(false);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [medicalAidOpen, setMedicalAidOpen] = useState(false);
  const [addVisitOpen, setAddVisitOpen] = useState(false);

  // — fetch patient
  const {
    data: patient,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      if (!id) throw new Error('Patient ID required');
      const { data, error } = await supabase
        .from('patient_details_view')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        logDatabaseError(error, `PatientDetail ID:${id}`);
        throw error;
      }
      return data as Patient;
    },
    enabled: !!id
  });

  // — mutation example (not shown in UI here)
  const updatePatient = useMutation({
    mutationFn: async (updates: Partial<Patient>) => {
      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] });
    }
  });

  const handleSuccess = (close: React.Dispatch<React.SetStateAction<boolean>>) => {
    qc.invalidateQueries({ queryKey: ['patient', id] });
    close(false);
  };

  const age = useMemo(() =>
    patient?.date_of_birth
      ? differenceInYears(new Date(), new Date(patient.date_of_birth))
      : null,
  [patient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 bg-white rounded-xl shadow-lg text-center"
        >
          <Loader2 className="animate-spin text-sky-500 mb-4 mx-auto" size={48} />
          <p className="text-lg font-medium text-gray-700">Loading patient...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-white rounded-xl shadow-lg text-center max-w-md"
        >
          <AlertCircle className="text-red-500 mb-4 mx-auto" size={48} />
          <p className="text-xl font-semibold text-gray-700 mb-2">Record not found</p>
          <Button variant="outline" onClick={() => navigate('/patients')}>
            <ChevronLeft className="mr-2" /> Back
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
      className="min-h-screen bg-slate-100 p-6 lg:p-8"
    >
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/patients')} aria-label="Back">
            <ChevronLeft size={24} />
          </Button>
          <div>
            <h1 className="text-[30px] font-bold text-[#494c61]">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-gray-500">Patient ID: {patient.id}</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          <Button onClick={() => setAddVisitOpen(true)}>
            <FilePlus className="mr-2" /> Record Visit
          </Button>
          <Button onClick={() => setNextOfKinOpen(true)}>
            <Users className="mr-2" /> Next of Kin
          </Button>
          <Button onClick={() => setMedicalAidOpen(true)}>
            <ShieldCheck className="mr-2" /> Medical Aid
          </Button>
          <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['patient', id] })}>
            <RefreshCw className="mr-2" /> Refresh
          </Button>
          <Button variant="ghost" aria-label="Edit">
            <Edit3 size={20} />
          </Button>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Profile Card */}
          <Card className="shadow-lg">
            <div className="h-28 bg-gradient-to-r from-cyan-400 to-blue-500" />
            <CardContent className="relative -mt-14 pt-16 text-center">
              <div className="absolute left-1/2 -translate-x-1/2 -top-12 bg-white rounded-full p-1 shadow-md">
                <User className="text-blue-500" size={48} />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800">
                {patient.first_name} {patient.last_name}
              </h2>
              <p className="text-gray-500">{age} yrs • {patient.gender}</p>
              <div className="mt-4 flex justify-center space-x-2">
                <Badge variant="success">Active</Badge>
                {patient.occupation && <Badge variant="info">{patient.occupation}</Badge>}
              </div>
              <div className="mt-6 space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-center space-x-2">
                  <Mail className="text-blue-500" /><span>{patient.email}</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Phone className="text-blue-500" /><span>{patient.cell_number}</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <MapPin className="text-blue-500" /><span>{patient.home_address}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Aid Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-700">
                <ShieldCheck size={20} className="text-green-600" /> Medical Aid
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.medical_aid_details?.[0] ? (
                <>
                  <p><strong>Provider:</strong> {patient.medical_aid_details[0].provider}</p>
                  <p><strong>Scheme:</strong> {patient.medical_aid_details[0].scheme}</p>
                  <p><strong>Member #:</strong> {patient.medical_aid_details[0].membershipNumber}</p>
                </>
              ) : (
                <p className="text-gray-500">No info on file.</p>
              )}
            </CardContent>
          </Card>

          {/* Next of Kin Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-700">
                <Users size={20} className="text-red-500" /> Next of Kin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.next_of_kin?.[0] ? (
                <>
                  <p><strong>Name:</strong> {patient.next_of_kin[0].name}</p>
                  <p><strong>Relation:</strong> {patient.next_of_kin[0].relationship}</p>
                  <p><strong>Phone:</strong> {patient.next_of_kin[0].phone}</p>
                </>
              ) : (
                <p className="text-gray-500">No info on file.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <VisitsTimeline patientId={id!} />

          {/* AI Summary */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Brain size={22} className="text-cyan-400" />
                    <CardTitle className="text-xl">AI Insights</CardTitle>
                  </div>
                  <Sparkles size={16} className="text-cyan-200" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  {patient.first_name} {patient.last_name} is a {age}-year-old {patient.gender}.
                </p>
                <p>
                  Next visit scheduled in 3 months. Continue current care plan.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Modals */}
      <FormModal isOpen={addVisitOpen} onClose={() => setAddVisitOpen(false)} title="Record Visit">
        <AddVisitForm
          patientId={id!}
          onSuccess={() => handleSuccess(setAddVisitOpen)}
        />
      </FormModal>

      <FormModal isOpen={nextOfKinOpen} onClose={() => setNextOfKinOpen(false)} title="Next of Kin">
        <NextOfKinForm
          patientId={id!}
          initialData={patient.next_of_kin?.[0]}
          onSuccess={() => handleSuccess(setNextOfKinOpen)}
        />
      </FormModal>

      <FormModal isOpen={medicalAidOpen} onClose={() => setMedicalAidOpen(false)} title="Medical Aid">
        {/* You can reuse EditPatientForm or create a dedicated MedicalAidForm here */}
        <EditPatientForm
          patientId={id!}
          initialData={patient}
          onSuccess={() => handleSuccess(setMedicalAidOpen)}
        />
      </FormModal>

      <FormModal isOpen={editPatientOpen} onClose={() => setEditPatientOpen(false)} title="Edit Patient">
        <EditPatientForm
          patientId={id!}
          initialData={patient}
          onSuccess={() => handleSuccess(setEditPatientOpen)}
        />
      </FormModal>
    </motion.div>
  );
};

export default PatientDetail;
