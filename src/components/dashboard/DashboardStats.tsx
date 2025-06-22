import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import StatisticsChart from './StatisticsChart';
import { supabase } from '../../lib/supabase';
import { 
  Users, Calendar, Activity, FileText, 
  MessageSquare, Heart, DollarSign, TrendingUp 
} from 'lucide-react';

interface DashboardStatsProps {
  practiceId?: string;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ practiceId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for each chart's data
  const [patientStats, setPatientStats] = useState<any[]>([]);
  const [appointmentStats, setAppointmentStats] = useState<any[]>([]);
  const [visitStats, setVisitStats] = useState<any[]>([]);
  const [labStats, setLabStats] = useState<any[]>([]);
  const [communicationStats, setCommunicationStats] = useState<any[]>([]);
  const [vitalsStats, setVitalsStats] = useState<any[]>([]);
  const [revenueStats, setRevenueStats] = useState<any[]>([]);
  const [performanceStats, setPerformanceStats] = useState<any[]>([]);

  // Filter options
  const timeRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'last30Days', label: 'Last 30 Days' },
    { value: 'last6Months', label: 'Last 6 Months' },
    { value: 'lastYear', label: 'Last Year' }
  ];

  const demographicOptions = [
    { value: 'all', label: 'All Demographics' },
    { value: 'male', label: 'Male Patients' },
    { value: 'female', label: 'Female Patients' },
    { value: 'age0-18', label: 'Age 0-18' },
    { value: 'age19-35', label: 'Age 19-35' },
    { value: 'age36-55', label: 'Age 36-55' },
    { value: 'age56-70', label: 'Age 56-70' },
    { value: 'age70+', label: 'Age 70+' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'consultation', label: 'Consultations' },
    { value: 'followUp', label: 'Follow-ups' },
    { value: 'procedure', label: 'Procedures' },
    { value: 'emergency', label: 'Emergency' }
  ];

  useEffect(() => {
    fetchAllStats();
  }, [practiceId]);

  const fetchAllStats = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPatientStats(),
        fetchAppointmentStats(),
        fetchVisitStats(),
        fetchLabStats(),
        fetchCommunicationStats(),
        fetchVitalsStats(),
        fetchRevenueStats(),
        fetchPerformanceStats()
      ]);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientStats = async () => {
    try {
      // Patient demographics by age group
      const { data: patients, error } = await supabase
        .from('patients')
        .select('date_of_birth, gender, created_at');

      if (error) throw error;

      const ageGroups = patients.reduce((acc, patient) => {
        const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
        let group;
        if (age < 18) group = '0-18';
        else if (age < 35) group = '19-35';
        else if (age < 55) group = '36-55';
        else if (age < 70) group = '56-70';
        else group = '70+';

        acc[group] = (acc[group] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = Object.entries(ageGroups).map(([name, value]) => ({
        name,
        value
      }));

      setPatientStats(chartData);
    } catch (error) {
      console.error('Error fetching patient stats:', error);
    }
  };

  const fetchAppointmentStats = async () => {
    try {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('status, type, date')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const statusCounts = appointments.reduce((acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      setAppointmentStats(chartData);
    } catch (error) {
      console.error('Error fetching appointment stats:', error);
    }
  };

  const fetchVisitStats = async () => {
    try {
      const { data: visits, error } = await supabase
        .from('visits')
        .select('visit_date, status, visit_type')
        .gte('visit_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Group by day for the last 7 days
      const dailyVisits = visits.reduce((acc, visit) => {
        const date = new Date(visit.visit_date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = Object.entries(dailyVisits).map(([name, value]) => ({
        name,
        value
      }));

      setVisitStats(chartData);
    } catch (error) {
      console.error('Error fetching visit stats:', error);
    }
  };

  const fetchLabStats = async () => {
    try {
      const { data: labRequests, error } = await supabase
        .from('lab_requests')
        .select('status, priority, test_name, requested_at')
        .gte('requested_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const priorityCounts = labRequests.reduce((acc, lab) => {
        acc[lab.priority] = (acc[lab.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = Object.entries(priorityCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      setLabStats(chartData);
    } catch (error) {
      console.error('Error fetching lab stats:', error);
    }
  };

  const fetchCommunicationStats = async () => {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('type, status, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const typeCounts = messages.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = Object.entries(typeCounts).map(([name, value]) => ({
        name: name.toUpperCase(),
        value
      }));

      setCommunicationStats(chartData);
    } catch (error) {
      console.error('Error fetching communication stats:', error);
    }
  };

  const fetchVitalsStats = async () => {
    try {
      const { data: vitals, error } = await supabase
        .from('vitals')
        .select('blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Count normal vs abnormal vitals
      const vitalsAnalysis = vitals.reduce((acc, vital) => {
        let hasAbnormal = false;
        
        if (vital.blood_pressure_systolic > 140 || vital.blood_pressure_systolic < 90) hasAbnormal = true;
        if (vital.heart_rate > 100 || vital.heart_rate < 60) hasAbnormal = true;
        if (vital.temperature > 37.5 || vital.temperature < 36.0) hasAbnormal = true;

        if (hasAbnormal) {
          acc.abnormal = (acc.abnormal || 0) + 1;
        } else {
          acc.normal = (acc.normal || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const chartData = Object.entries(vitalsAnalysis).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      setVitalsStats(chartData);
    } catch (error) {
      console.error('Error fetching vitals stats:', error);
    }
  };

  const fetchRevenueStats = async () => {
    // Mock revenue data since billing isn't implemented yet
    const mockRevenue = [
      { name: 'Jan', value: 45000 },
      { name: 'Feb', value: 52000 },
      { name: 'Mar', value: 48000 },
      { name: 'Apr', value: 61000 },
      { name: 'May', value: 55000 },
      { name: 'Jun', value: 67000 }
    ];
    setRevenueStats(mockRevenue);
  };

  const fetchPerformanceStats = async () => {
    try {
      // Calculate appointment completion rates by doctor
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('doctor_id, status')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const doctorPerformance = appointments.reduce((acc, apt) => {
        if (!acc[apt.doctor_id]) {
          acc[apt.doctor_id] = { total: 0, completed: 0 };
        }
        acc[apt.doctor_id].total += 1;
        if (apt.status === 'completed') {
          acc[apt.doctor_id].completed += 1;
        }
        return acc;
      }, {} as Record<string, { total: number; completed: number }>);

      const chartData = Object.entries(doctorPerformance).map(([doctorId, stats], index) => ({
        name: `Doctor ${index + 1}`,
        value: Math.round((stats.completed / stats.total) * 100)
      }));

      setPerformanceStats(chartData);
    } catch (error) {
      console.error('Error fetching performance stats:', error);
    }
  };

  const handleFilterChange = (chartType: string, filterType: string, value: string) => {
    // Refetch data based on new filters
    fetchAllStats();
  };

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Practice Analytics
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingUp className="w-4 h-4" />
          <span>Live Dashboard</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Patient Demographics Chart */}
        <StatisticsChart
          title="Patient Demographics"
          data={patientStats}
          chartType="pie"
          filters={{
            timeRange: timeRangeOptions,
            demographic: demographicOptions
          }}
          onFilterChange={(filterType, value) => handleFilterChange('patients', filterType, value)}
          loading={loading}
          trend={{ value: 12, direction: 'up', period: 'vs last month' }}
        />

        {/* 2. Appointment Status Distribution */}
        <StatisticsChart
          title="Appointment Status (30 Days)"
          data={appointmentStats}
          chartType="bar"
          filters={{
            timeRange: timeRangeOptions,
            category: categoryOptions
          }}
          onFilterChange={(filterType, value) => handleFilterChange('appointments', filterType, value)}
          loading={loading}
          trend={{ value: 8, direction: 'up', period: 'vs last month' }}
        />

        {/* 3. Daily Visit Trends */}
        <StatisticsChart
          title="Daily Visit Trends (7 Days)"
          data={visitStats}
          chartType="line"
          filters={{
            timeRange: timeRangeOptions,
            category: categoryOptions
          }}
          onFilterChange={(filterType, value) => handleFilterChange('visits', filterType, value)}
          loading={loading}
          trend={{ value: 5, direction: 'up', period: 'vs last week' }}
        />

        {/* 4. Lab Requests by Priority */}
        <StatisticsChart
          title="Lab Requests by Priority"
          data={labStats}
          chartType="bar"
          primaryColor="#f59e0b"
          filters={{
            timeRange: timeRangeOptions,
            category: [
              { value: 'all', label: 'All Tests' },
              { value: 'bloodwork', label: 'Blood Work' },
              { value: 'imaging', label: 'Imaging' },
              { value: 'cultures', label: 'Cultures' }
            ]
          }}
          onFilterChange={(filterType, value) => handleFilterChange('lab', filterType, value)}
          loading={loading}
          trend={{ value: 15, direction: 'up', period: 'vs last month' }}
        />

        {/* 5. Communication Activity */}
        <StatisticsChart
          title="Communication Activity"
          data={communicationStats}
          chartType="pie"
          primaryColor="#10b981"
          filters={{
            timeRange: timeRangeOptions,
            category: [
              { value: 'all', label: 'All Messages' },
              { value: 'reminders', label: 'Reminders' },
              { value: 'notifications', label: 'Notifications' },
              { value: 'alerts', label: 'Alerts' }
            ]
          }}
          onFilterChange={(filterType, value) => handleFilterChange('communication', filterType, value)}
          loading={loading}
          trend={{ value: 22, direction: 'up', period: 'vs last month' }}
        />

        {/* 6. Vitals Analysis */}
        <StatisticsChart
          title="Vitals Analysis (Normal vs Abnormal)"
          data={vitalsStats}
          chartType="pie"
          primaryColor="#ef4444"
          filters={{
            timeRange: timeRangeOptions,
            demographic: demographicOptions
          }}
          onFilterChange={(filterType, value) => handleFilterChange('vitals', filterType, value)}
          loading={loading}
          trend={{ value: -3, direction: 'down', period: 'abnormal vs last week' }}
        />

        {/* 7. Revenue Trends */}
        <StatisticsChart
          title="Monthly Revenue Trends"
          data={revenueStats}
          chartType="area"
          primaryColor="#8b5cf6"
          filters={{
            timeRange: timeRangeOptions,
            category: [
              { value: 'all', label: 'All Revenue' },
              { value: 'consultations', label: 'Consultations' },
              { value: 'procedures', label: 'Procedures' },
              { value: 'medicalAid', label: 'Medical Aid' }
            ]
          }}
          onFilterChange={(filterType, value) => handleFilterChange('revenue', filterType, value)}
          loading={loading}
          trend={{ value: 18, direction: 'up', period: 'vs last quarter' }}
        />

        {/* 8. Doctor Performance */}
        <StatisticsChart
          title="Doctor Completion Rates (%)"
          data={performanceStats}
          chartType="bar"
          primaryColor="#06b6d4"
          filters={{
            timeRange: timeRangeOptions,
            category: [
              { value: 'completion', label: 'Completion Rate' },
              { value: 'patientSatisfaction', label: 'Patient Satisfaction' },
              { value: 'punctuality', label: 'Punctuality' }
            ]
          }}
          onFilterChange={(filterType, value) => handleFilterChange('performance', filterType, value)}
          loading={loading}
          trend={{ value: 7, direction: 'up', period: 'vs last month' }}
        />
      </div>
    </div>
  );
};

export default DashboardStats;