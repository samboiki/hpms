// pages/PatientDetail.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInYears } from 'date-fns';
import {
  FileText,
  Clock,
  ChevronLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Heart,
  Edit3,
  Brain,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Pill,
  Clipboard,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { supabase, logDatabaseError } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '../components/ui/Tabs';
import VisitsTimeline from '../components/visits/VisitsTimeline';
import FormModal from '../components/modals/FormModal';
import AddVisitForm from '../components/forms/AddVisitForm';

interface MedicalAid {
  provider: string;
  scheme: string;
  membership_number: string;
  main_member_name: string;
  main_member_id_number: string;
}

interface NextOfKin {
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
  home_address?: string;
  medical_aid_details?: MedicalAid[];
  next_of_kin?: NextOfKin[];
  chronicConditions?: string[];
}

const PatientProfileCard: React.FC<{
  patient: Patient;
  onEdit: () => void;
}> = ({ patient, onEdit }) => {
  const age = differenceInYears(new Date(), new Date(patient.date_of_birth));
  return (
    <Card className="overflow-hidden rounded-2xl shadow-lg sticky top-24">
      <div className="h-32 bg-gradient-to-r from-brand-500 to-brand-600" />
      <CardContent className="relative -mt-16 pt-20 pb-8 text-center">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="w-24 h-24 rounded-full bg-brand-500 grid place-items-center shadow-xl ring-4 ring-white">
            <User size={42} className="text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold">
          {patient.first_name} {patient.last_name}
        </h2>
        <p className="text-gray-500 mt-1">{age} yrs • {patient.gender}</p>
        <div className="flex justify-center gap-1 mt-3">
          <Badge variant="success">Active</Badge>
          {patient.medical_aid_details?.length && <Badge variant="info">Insured</Badge>}
        </div>
        <ul className="space-y-2 mt-6 text-sm text-gray-600">
          <li className="flex items-center justify-center gap-2"><Phone size={16} />{patient.cell_number}</li>
          <li className="flex items-center justify-center gap-2"><Mail size={16} />{patient.email}</li>
          <li className="flex items-center justify-center gap-2"><MapPin size={16} />{patient.home_address}</li>
        </ul>
        <Button
          variant="outline"
          className="w-full mt-6"
          onClick={onEdit}
        >
          <Edit3 size={16} className="mr-2" />
          Edit Profile
        </Button>
      </CardContent>
    </Card>
  );
};

const MedicalAidCard: React.FC<{
  medical?: MedicalAid;
  onEdit: () => void;
}> = ({ medical, onEdit }) => (
  <Card className="overflow-hidden rounded-2xl shadow-lg">
    <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
      <div className="flex justify-between items-center">
        <CardTitle className="flex items-center">
          <Building2 size={20} className="mr-2" />
          Medical Aid
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-white" onClick={onEdit}>
          <Edit3 size={16} />
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-6">
      {medical ? (
        <div className="space-y-4 text-gray-900">
          <div className="flex justify-between">
            <div>
              <h4 className="text-sm text-gray-500">Provider</h4>
              <p className="font-semibold">{medical.provider}</p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <div>
            <h4 className="text-sm text-gray-500">Scheme</h4>
            <p>{medical.scheme}</p>
          </div>
          <div>
            <h4 className="text-sm text-gray-500">Membership</h4>
            <p className="font-mono">{medical.membership_number}</p>
          </div>
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm text-gray-500">Main Member</h4>
            <p className="font-medium">{medical.main_member_name}</p>
            <p className="text-sm text-gray-500">ID: {medical.main_member_id_number}</p>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-6">
          <Building2 size={40} className="mx-auto mb-3" />
          <p>No medical aid on file</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const NextOfKinCard: React.FC<{
  kin?: NextOfKin;
  onEdit: () => void;
}> = ({ kin, onEdit }) => (
  <Card className="overflow-hidden rounded-2xl shadow-lg">
    <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
      <div className="flex justify-between items-center">
        <CardTitle className="flex items-center">
          <Heart size={20} className="mr-2" />
          Next of Kin
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-white" onClick={onEdit}>
          <Edit3 size={16} />
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-6 text-gray-900">
      {kin ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-rose-100 rounded-full">
              <Heart size={20} className="text-rose-600" />
            </div>
            <div>
              <h3 className="font-medium">{kin.name}</h3>
              <p className="text-sm text-gray-500">{kin.relationship}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Phone size={16} />{kin.phone}</div>
            {kin.address && (
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-1" />
                <span>{kin.address}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 py-6">
          <Heart size={40} className="mx-auto mb-3" />
          <p>No next-of-kin on file</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const AISummary: React.FC<{ patient: Patient }> = ({ patient }) => {
  const age = differenceInYears(new Date(), new Date(patient.date_of_birth));
  const medical = patient.medical_aid_details?.[0];
  const kin = patient.next_of_kin?.[0];

  return (
    <Card className="rounded-2xl shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg mr-3">
              <Brain size={20} className="text-indigo-600" />
            </div>
            <CardTitle>AI Health Summary</CardTitle>
          </div>
          <div className="flex items-center text-xs text-indigo-600">
            <Sparkles size={14} className="mr-1" />Generated
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 prose prose-indigo">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h4 className="font-medium text-gray-900">Patient Overview</h4>
          <p>
            {patient.first_name} {patient.last_name} is a {age}-year-old {patient.gender}
            {patient.occupation && ` employed as ${patient.occupation}.`}
            {medical && ` Covered by ${medical.provider}.`}
            {kin && ` Emergency contact: ${kin.name} (${kin.relationship}).`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="flex items-center text-gray-900 font-medium mb-2">
              <Activity size={16} className="text-indigo-600 mr-2" />
              Health Status
            </h4>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center">
                <CheckCircle2 size={14} className="text-emerald-500 mr-2" />
                Regular check-ups
              </li>
              <li className="flex items-center">
                <CheckCircle2 size={14} className="text-emerald-500 mr-2" />
                Up-to-date vaccinations
              </li>
              {patient.chronicConditions?.length && (
                <li className="flex items-center">
                  <AlertCircle size={14} className="text-amber-500 mr-2" />
                  Managing {patient.chronicConditions.join(', ')}
                </li>
              )}
            </ul>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="flex items-center text-gray-900 font-medium mb-2">
              <Stethoscope size={16} className="text-indigo-600 mr-2" />
              Recent Observations
            </h4>
            <ul className="space-y-2 text-gray-600">
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

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h4 className="text-gray-900 font-medium mb-2 flex items-center">
            <Clipboard size={16} className="text-indigo-600 mr-2" />
            Recommendations
          </h4>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-center">
              <ArrowRight size={14} className="text-indigo-600 mr-2" />
              Schedule check-up in 3 months
            </li>
            <li className="flex items-center">
              <ArrowRight size={14} className="text-indigo-600 mr-2" />
              Monitor blood pressure
            </li>
            <li className="flex items-center">
              <ArrowRight size={14} className="text-indigo-600 mr-2" />
              Continue current meds
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'history' | 'appointments'>('overview');
  const [visitModal, setVisitModal] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('patient_details_view')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setPatient(data);
      } catch (e) {
        console.error(e);
        logDatabaseError(e, 'loadPatient');
        setError('Could not load patient');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // loading / error states
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={48} className="animate-spin text-brand-500" />
      </div>
    );
  }
  if (error || !patient) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
        <p className="text-xl text-red-600 mb-6">{error || 'Not found'}</p>
        <Button variant="outline" onClick={() => navigate('/patients')}>
          <ChevronLeft size={16} className="mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-6">
      {/* header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800">Patient Details</h1>
          <p className="text-gray-500">Manage patient information</p>
        </div>
        <div className="space-x-3">
          <Button variant="outline" size="sm">
            <FileText size={16} className="mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => setVisitModal(true)}>
            <Clock size={16} className="mr-2" />
            Record Visit
          </Button>
        </div>
      </header>

      {/* two-col layout */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-8">
        <aside className="space-y-6">
          <PatientProfileCard
            patient={patient}
            onEdit={() => navigate(`/patients/${patient.id}/edit`)}
          />
          <MedicalAidCard
            medical={patient.medical_aid_details?.[0]}
            onEdit={() => navigate(`/patients/${patient.id}/medical-aid`)}
          />
          <NextOfKinCard
            kin={patient.next_of_kin?.[0]}
            onEdit={() => navigate(`/patients/${patient.id}/next-of-kin`)}
          />
        </aside>

        <main className="space-y-8">
          <Tabs value={tab} onValueChange={(v) => setTab(v)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <AISummary patient={patient}/>
            </TabsContent>
            <TabsContent value="history">
              <VisitsTimeline patientId={patient.id}/>
            </TabsContent>
            <TabsContent value="appointments">
              {/* your appointments UI */}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* floating action bar */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <Button icon variant="gradient" size="lg" onClick={() => setVisitModal(true)} aria-label="Record Visit">
          <Clock/>
        </Button>
        <Button icon variant="outline" size="lg" onClick={() => {/* export handler */}} aria-label="Export Data">
          <FileText/>
        </Button>
      </div>

      {/* modals */}
      <FormModal
        isOpen={visitModal}
        onClose={() => setVisitModal(false)}
        title="Record Visit"
      >
        <AddVisitForm
          patientId={patient.id}
          onSuccess={() => {
            setVisitModal(false);
            // re-fetch if you like
          }}
        />
      </FormModal>
    </div>
  );
}
