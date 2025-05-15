// src/pages/PatientDetail.tsx

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, differenceInYears } from 'date-fns';
import {
  ChevronLeft,
  FilePlus,
  Users,
  ShieldCheck,
  Edit3,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  Brain,
  Sparkles
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import AddVisitForm from '../components/forms/AddVisitForm';
import MedicalAidForm from '../components/forms/MedicalAidForm';
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

  const [openNextOfKin, setOpenNextOfKin] = useState(false);
  const [openEditPatient, setOpenEditPatient] = useState(false);
  const [openMedicalAid, setOpenMedicalAid] = useState(false);
  const [openAddVisit, setOpenAddVisit] = useState(false);

  // Fetch patient
  const { data: patient, isLoading, error } = useQuery({
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

  const age = useMemo(() =>
    patient?.date_of_birth ? differenceInYears(new Date(), new Date(patient.date_of_birth)) : null,
  [patient]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
    </div>
  );

  if (error || !patient) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <AlertCircle className="text-red-500" size={48} />
      <p className="ml-2 text-gray-600">Unable to load patient data.</p>
    </div>
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white"
    >
      {/* Hero */}
      <div className="relative h-60 bg-gradient-to-r from-indigo-600 to-indigo-400">
        <Button
          variant="ghost"
          className="absolute top-4 left-4 text-white"
          onClick={() => navigate('/patients')}
        >
          <ChevronLeft size={24} />
        </Button>
        <div className="absolute bottom-4 left-8 text-white">
          <h1 className="text-[30px] font-bold">{patient.first_name} {patient.last_name}</h1>
          <p className="text-sm">{age} yrs • {patient.gender}</p>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 p-8">
        {/* Sidebar */}
        <aside className="space-y-8 sticky top-24">
          <Card className="shadow-lg rounded-2xl">
            <CardContent className="space-y-2">
              <p><User className="inline-block mr-2 text-indigo-500"/> <span className="font-semibold">Email:</span> {patient.email}</p>
              <p><Phone className="inline-block mr-2 text-indigo-500"/> <span className="font-semibold">Phone:</span> {patient.cell_number}</p>
              <p><MapPin className="inline-block mr-2 text-indigo-500"/> <span className="font-semibold">Address:</span> {patient.home_address}</p>
              {patient.occupation && (
                <p><Briefcase className="inline-block mr-2 text-indigo-500"/> <span className="font-semibold">Occupation:</span> {patient.occupation}</p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-4">
            <Button
              variant="gradient"
              className="w-full flex items-center justify-center space-x-2"
              onClick={() => setOpenAddVisit(true)}
            >
              <FilePlus /> <span>Record Visit</span>
            </Button>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center space-x-2"
              onClick={() => setOpenNextOfKin(true)}
            >
              <Users /> <span>Next of Kin</span>
            </Button>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center space-x-2"
              onClick={() => setOpenMedicalAid(true)}
            >
              <ShieldCheck /> <span>Medical Aid</span>
            </Button>
          </div>
        </aside>

        {/* Main */}
        <motion.div variants={itemVariants} className="space-y-8">
          <VisitsTimeline patientId={id!} />
        </motion.div>
      </div>

      {/* Modals */}
      <FormModal isOpen={openAddVisit} onClose={() => setOpenAddVisit(false)} title="Record Visit">
        <AddVisitForm
          patientId={id!}
          onSuccess={() => { qc.invalidateQueries({ queryKey:['patient', id] }); setOpenAddVisit(false); }}
        />
      </FormModal>

      <FormModal isOpen={openNextOfKin} onClose={() => setOpenNextOfKin(false)} title="Next of Kin">
        <NextOfKinForm
          patientId={id!}
          initialData={patient.next_of_kin?.[0]}
          onSuccess={() => { qc.invalidateQueries({ queryKey:['patient', id] }); setOpenNextOfKin(false); }}
        />
      </FormModal>

      <FormModal isOpen={openMedicalAid} onClose={() => setOpenMedicalAid(false)} title="Medical Aid">
        <MedicalAidForm
          patientId={id!}
          initialData={patient.medical_aid_details?.[0]}
          onSuccess={() => { qc.invalidateQueries({ queryKey:['patient', id] }); setOpenMedicalAid(false); }}
        />
      </FormModal>
    </motion.div>
  );
};

export default PatientDetail;
