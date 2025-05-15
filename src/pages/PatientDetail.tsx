// src/pages/PatientDetail.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInYears } from 'date-fns';
import {
  ChevronLeft,
  FilePlus,
  Users,
  ShieldCheck,
  Edit3,
  Loader2
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import FormModal from '../components/modals/FormModal';
import AddVisitForm from '../components/forms/AddVisitForm';
import NextOfKinForm from '../components/forms/NextOfKinForm';
import MedicalAidForm from '../components/forms/MedicalAidForm';
import { supabase, logDatabaseError } from '../lib/supabase';
import VisitsTimeline from '../components/visits/VisitsTimeline';

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
  medical_aid_details?: any[];
  next_of_kin?: any[];
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [visitOpen, setVisitOpen] = useState(false);
  const [kinOpen, setKinOpen]     = useState(false);
  const [aidOpen, setAidOpen]     = useState(false);

  // Fetch patient data
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
        logDatabaseError(error, 'PatientDetail');
        throw error;
      }
      return data as Patient;
    },
    enabled: !!id
  });

  const age = useMemo(() => (
    patient?.date_of_birth
      ? differenceInYears(new Date(), new Date(patient.date_of_birth))
      : null
  ), [patient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Error loading patient or not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Hero Header */}
      <div className="relative h-60 bg-gradient-to-r from-indigo-600 to-indigo-400">
        <Button
          variant="ghost"
          className="absolute top-4 left-4 text-white"
          onClick={() => navigate('/patients')}
        >
          <ChevronLeft size={24} />
        </Button>
        <div className="absolute bottom-4 left-8 text-white">
          <h1 className="text-[30px] font-bold">
            {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-sm">{age} yrs • {patient.gender}</p>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 p-8">

        {/* Sidebar */}
        <aside className="space-y-8 sticky top-24">
          <Card className="shadow-lg rounded-2xl">
            <CardContent className="space-y-2">
              <p><span className="font-semibold">Email:</span> {patient.email}</p>
              <p><span className="font-semibold">Phone:</span> {patient.cell_number}</p>
              <p><span className="font-semibold">Address:</span> {patient.home_address}</p>
              {patient.occupation && (
                <p><span className="font-semibold">Occupation:</span> {patient.occupation}</p>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button
              variant="primary"
              className="w-full flex items-center justify-center space-x-2"
              onClick={() => setVisitOpen(true)}
            >
              <FilePlus /> <span>Record Visit</span>
            </Button>
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center space-x-2"
              onClick={() => setKinOpen(true)}
            >
              <Users /> <span>Next of Kin</span>
            </Button>
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center space-x-2"
              onClick={() => setAidOpen(true)}
            >
              <ShieldCheck /> <span>Medical Aid</span>
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="space-y-8">
          <VisitsTimeline patientId={id!} />
        </main>
      </div>

      {/* Modals */}
      <FormModal isOpen={visitOpen} onClose={() => setVisitOpen(false)} title="Record Visit">
        <AddVisitForm
          patientId={id!}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['patient', id] }); setVisitOpen(false); }}
        />
      </FormModal>

      <FormModal isOpen={kinOpen} onClose={() => setKinOpen(false)} title="Next of Kin">
        <NextOfKinForm
          patientId={id!}
          initialData={patient.next_of_kin?.[0]}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['patient', id] }); setKinOpen(false); }}
        />
      </FormModal>

      <FormModal isOpen={aidOpen} onClose={() => setAidOpen(false)} title="Medical Aid">
        <MedicalAidForm
          patientId={id!}
          initialData={patient.medical_aid_details?.[0]}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['patient', id] }); setAidOpen(false); }}
        />
      </FormModal>

    </div>
  );
}
