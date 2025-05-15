// pages/PatientDetail.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInYears } from 'date-fns';
import {
  ChevronLeft,
  Clock,
  FilePlus,
  Edit3,
  Search,
  Filter,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, logDatabaseError } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import VisitsTimeline from '../components/visits/VisitsTimeline';
import FormModal from '../components/modals/FormModal';
import AddVisitForm from '../components/forms/AddVisitForm';
import AddLabResultForm from '../components/forms/AddLabResultForm';

type TabKey = 'overview' | 'history' | 'labs' | 'appointments';

interface Vital {
  id: string;
  patient_id: string;
  timestamp: string;
  systolic: number;
  diastolic: number;
  heart_rate: number;
}

interface LabResult {
  id: string;
  patient_id: string;
  test_name: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  home_address: string;
  occupation?: string;
  totalVisits?: number;
  totalReports?: number;
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview',   label: 'Overview' },
  { key: 'history',    label: 'History' },
  { key: 'labs',       label: 'Lab Results' },
  { key: 'appointments', label: 'Appointments' },
];

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<'all' | 'recent'>('all');
  const [visitModal, setVisitModal] = useState(false);
  const [labModal, setLabModal]     = useState(false);

  /** fetch patient */
  const {
    data: patient,
    isLoading: patientLoading,
    error: patientError,
  } = useQuery(['patient', id], async () => {
    const { data, error } = await supabase
      .from('patient_details_view')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Patient;
  }, { enabled: !!id });

  /** fetch vitals */
  const {
    data: vitals = [],
    isLoading: vitalsLoading,
  } = useQuery(['vitals', id], async () => {
    const { data, error } = await supabase
      .from<Vital>('vitals')
      .select('*')
      .eq('patient_id', id)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return data;
  }, { enabled: !!id });

  /** fetch lab results */
  const {
    data: labs = [],
    isLoading: labsLoading,
  } = useQuery(['labs', id], async () => {
    const { data, error } = await supabase
      .from<LabResult>('lab_results')
      .select('*')
      .eq('patient_id', id)
      .order('timestamp', { descending: true })
      .limit(10);
    if (error) throw error;
    return data;
  }, { enabled: !!id });

  /** age calculation */
  const age = useMemo(
    () => patient?.date_of_birth
      ? differenceInYears(new Date(), new Date(patient.date_of_birth))
      : null,
    [patient]
  );

  /** transform vitals for chart */
  const vitalChartData = useMemo(() => 
    vitals.map(v => ({
      time: format(new Date(v.timestamp), 'MMM d'),
      Systolic: v.systolic,
      Diastolic: v.diastolic,
      'Heart Rate': v.heart_rate
    })),
  [vitals]);

  /** filtered history (VisitsTimeline supports `search` & `filter`) */

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="p-6 bg-white rounded-xl shadow-lg text-center">
          <Clock className="mx-auto mb-4 text-cyan-500 animate-spin" size={40} />
          <p className="text-gray-700 font-medium">Loading patient...</p>
        </div>
      </div>
    );
  }
  if (patientError || !patient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="p-6 bg-white rounded-xl shadow-lg text-center max-w-sm">
          <Edit3 className="mx-auto mb-4 text-red-500" size={40} />
          <p className="text-gray-700 font-semibold mb-2">Patient not found</p>
          <Button onClick={() => navigate('/patients')} variant="secondary">
            <ChevronLeft className="mr-2" size={16} />
            Back to list
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            className="p-2"
            onClick={() => navigate('/patients')}
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-[30px] font-bold text-[#494c61]">
            {patient.first_name} {patient.last_name}
          </h1>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => setVisitModal(true)}
          >
            <FilePlus className="mr-2" /> Record Visit
          </Button>
          <Button
            variant="primary"
            onClick={() => setLabModal(true)}
          >
            <FilePlus className="mr-2" /> Add Lab Result
          </Button>
          <Button
            variant="secondary"
            onClick={() => queryClient.invalidateQueries(['patient', id])}
          >
            <RefreshCw className="mr-2" /> Refresh
          </Button>
          <Button
            variant="ghost"
            onClick={() => {}}
            aria-label="Edit Profile"
          >
            <Edit3 size={20} />
          </Button>
        </div>
      </header>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="space-y-6 sticky top-24">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-700">
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Age:</strong> {age} yrs</p>
              <p><strong>Gender:</strong> {patient.gender}</p>
              <p><strong>Email:</strong> {patient.email}</p>
              <p><strong>Phone:</strong> {patient.cell_number}</p>
              <p><strong>Address:</strong> {patient.home_address}</p>
              {patient.occupation && <p><strong>Occupation:</strong> {patient.occupation}</p>}
            </CardContent>
          </Card>
        </aside>

        {/* Main */}
        <main className="space-y-6">
          {/* Tabs */}
          <nav className="flex space-x-4 border-b border-gray-300">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`pb-2 ${
                  activeTab === t.key
                    ? 'border-b-2 border-cyan-500 text-cyan-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                style={{ fontSize: '16px' }}
                aria-current={activeTab === t.key ? 'page' : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Search & Filter */}
          {(activeTab === 'history' || activeTab === 'labs') && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-1 w-full md:w-1/2">
                <Search className="text-gray-500 mr-2" />
                <input
                  type="text"
                  className="w-full outline-none"
                  placeholder="Search records..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search records"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="text-gray-600" />
                <select
                  className="bg-white border border-gray-300 rounded-lg px-3 py-1"
                  value={filter}
                  onChange={e => setFilter(e.target.value as any)}
                  aria-label="Filter records"
                >
                  <option value="all">All</option>
                  <option value="recent">Recent</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Vital Signs Chart */}
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-700">
                    Vital Signs
                  </CardTitle>
                </CardHeader>
                <CardContent style={{ height: 250 }}>
                  {vitalsLoading ? (
                    <p>Loading chart…</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalChartData}>
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Systolic" stroke="#06B6D4" />
                        <Line type="monotone" dataKey="Diastolic" stroke="#8B5CF6" />
                        <Line type="monotone" dataKey="Heart Rate" stroke="#F97316" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Lab Results Chart */}
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-700">
                    Recent Lab Results
                  </CardTitle>
                </CardHeader>
                <CardContent style={{ height: 200 }}>
                  {labsLoading ? (
                    <p>Loading chart…</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={labs.map(l => ({
                        name: l.test_name,
                        value: l.value
                      }))}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#06B6D4" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'history' && (
            <VisitsTimeline
              patientId={id!}
              search={search}
              filter={filter}
            />
          )}

          {activeTab === 'labs' && (
            <div className="space-y-4">
              {labs.map(l => (
                <Card key={l.id} className="flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-medium text-gray-800">{l.test_name}</p>
                    <p className="text-sm text-gray-600">
                      {l.value} {l.unit} &bull; {format(new Date(l.timestamp), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    {l.value >= 0 ? (
                      <TrendingUp className="text-green-500" />
                    ) : (
                      <TrendingDown className="text-red-500" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="p-4 bg-white rounded-lg shadow-sm text-center text-gray-600">
              No appointments scheduled.
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <FormModal
        isOpen={visitModal}
        onClose={() => setVisitModal(false)}
        title="Record New Visit"
      >
        <AddVisitForm
          patientId={id!}
          onSuccess={() => {
            queryClient.invalidateQueries(['patient', id]);
            setVisitModal(false);
          }}
        />
      </FormModal>

      <FormModal
        isOpen={labModal}
        onClose={() => setLabModal(false)}
        title="Add Lab Result"
      >
        <AddLabResultForm
          patientId={id!}
          onSuccess={() => {
            queryClient.invalidateQueries(['labs', id]);
            setLabModal(false);
          }}
        />
      </FormModal>
    </div>
  );
}
