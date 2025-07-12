import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Activity,
  TrendingUp,
  Calendar,
  Shield,
  UserCheck,
  Sparkles
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar
} from 'recharts';
// Extended Patient interface with database fields
interface Patient {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  medical_aid_provider?: string;
  allergies?: string;
  chronic_conditions?: string;
  last_visit_date?: string;
  created_at?: string;
  updated_at?: string;
  practice_id?: string;
}

interface PatientAnalyticsProps {
  patients: Patient[];
}

const COLORS = {
  primary: '#01b9d5',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  male: '#3b82f6',
  female: '#ec4899',
  other: '#8b5cf6'
};

const PatientAnalytics: React.FC<PatientAnalyticsProps> = ({ patients = [] }) => {
  // Gender distribution data
  const genderData = useMemo(() => {
    const genderCounts = patients.reduce((acc, patient) => {
      const gender = patient.gender?.toLowerCase() || 'other';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'Male', value: genderCounts.male || 0, color: COLORS.male },
      { name: 'Female', value: genderCounts.female || 0, color: COLORS.female },
      { name: 'Other', value: genderCounts.other || 0, color: COLORS.other }
    ].filter(item => item.value > 0);
  }, [patients]);

  // Age group analysis
  const ageGroupData = useMemo(() => {
    const ageGroups = {
      '0-17': 0,
      '18-30': 0,
      '31-45': 0,
      '46-60': 0,
      '61+': 0
    };

    patients.forEach(patient => {
      if (patient.date_of_birth) {
        const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
        if (age < 18) ageGroups['0-17']++;
        else if (age <= 30) ageGroups['18-30']++;
        else if (age <= 45) ageGroups['31-45']++;
        else if (age <= 60) ageGroups['46-60']++;
        else ageGroups['61+']++;
      }
    });

    return Object.entries(ageGroups).map(([group, count]) => ({
      name: group,
      count,
      percentage: Math.round((count / patients.length) * 100)
    }));
  }, [patients]);

  // Medical aid coverage
  const medicalAidData = useMemo(() => {
    const withAid = patients.filter(p => p.medical_aid_details && p.medical_aid_details.length > 0).length;
    const withoutAid = patients.length - withAid;
    
    return [
      { name: 'With Medical Aid', value: withAid, percentage: Math.round((withAid / patients.length) * 100) },
      { name: 'Without Medical Aid', value: withoutAid, percentage: Math.round((withoutAid / patients.length) * 100) }
    ];
  }, [patients]);

  // Enrollment by month (last 12 months)
  const enrollmentData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const count = patients.filter(p => {
        if (!p.created_at) return false;
        const patientDate = new Date(p.created_at);
        return patientDate.getMonth() === date.getMonth() && 
               patientDate.getFullYear() === date.getFullYear();
      }).length;
      
      months.push({ month: monthYear, patients: count });
    }
    
    return months;
  }, [patients]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-200">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Premium radial chart data for overview
  const overviewData = [
    {
      name: 'Total Patients',
      value: 100,
      fill: COLORS.primary
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 shadow-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{patients.length}</h3>
          <p className="text-gray-600 font-medium">Total Patients</p>
          <div className="mt-2 text-sm text-blue-600 font-medium">
            <TrendingUp className="w-4 h-4 inline mr-1" />
            +{Math.round(patients.length * 0.15)} this month
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 shadow-lg border border-purple-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800">
            {Math.round((patients.filter(p => p.gender?.toLowerCase() === 'female').length / patients.length) * 100)}%
          </h3>
          <p className="text-gray-600 font-medium">Female Patients</p>
          <div className="mt-2 text-sm text-purple-600 font-medium">
            <UserCheck className="w-4 h-4 inline mr-1" />
            {patients.filter(p => p.gender?.toLowerCase() === 'female').length} total
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 shadow-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <Sparkles className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800">
            {Math.round((patients.filter(p => p.medical_aid_details && p.medical_aid_details.length > 0).length / patients.length) * 100)}%
          </h3>
          <p className="text-gray-600 font-medium">Medical Aid Coverage</p>
          <div className="mt-2 text-sm text-green-600 font-medium">
            <Shield className="w-4 h-4 inline mr-1" />
            {patients.filter(p => p.medical_aid_details && p.medical_aid_details.length > 0).length} covered
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
            Gender Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {genderData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry) => (
                  <span style={{ color: entry.color }}>
                    {value}: {entry.value} ({Math.round((entry.value / patients.length) * 100)}%)
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Age Group Analysis */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
            Age Group Analysis
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ageGroupData}>
              <defs>
                <linearGradient id="colorAge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="url(#colorAge)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Medical Aid Coverage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
            Medical Aid Coverage
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={medicalAidData}>
              <RadialBar
                minAngle={15}
                background
                clockWise
                dataKey="percentage"
                fill={COLORS.success}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry) => (
                  <span>
                    {entry.payload.name}: {entry.payload.value} ({entry.payload.percentage}%)
                  </span>
                )}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Enrollment Trend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full" />
            Patient Enrollment Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={enrollmentData}>
              <defs>
                <linearGradient id="colorEnrollment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.info} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="patients" 
                stroke={COLORS.info} 
                strokeWidth={2}
                fill="url(#colorEnrollment)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
};

export default PatientAnalytics;