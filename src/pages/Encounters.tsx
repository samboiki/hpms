import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { usePractice } from '../contexts/PracticeContext';
import { useAuthStore } from '../stores/authStore';
import { startOfMonth, endOfMonth, subMonths, parseISO, isToday, format } from 'date-fns';

// Import existing components
import LaboratoryTabContent from '../components/requests/LaboratoryTabContent';
import ImagingTabContent from '../components/requests/ImagingTabContent';
import FollowUpAutomationTab from '../components/encounters/FollowUpAutomationTab';
import { AdvancedEncountersDashboard } from '../components/encounters/AdvancedEncountersDashboard';

interface DashboardStats {
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  todayVisits: number;
  monthlyVisits: number;
  lastMonthVisits: number;
  avgVisitDuration: number;
  noShowRate: number;
  pendingLabs: number;
  completedLabs: number;
  pendingImaging: number;
  completedImaging: number;
  totalPrescriptions: number;
  totalRevenue: number;
  medicalAidRevenue: number;
  patientRevenue: number;
  providerProductivity: { [key: string]: number };
  visitTypes: { [key: string]: number };
  departmentDistribution: { [key: string]: number };
  monthlyTrends: Array<{ month: string; totalVisits: number; completedVisits: number; cancelledVisits: number }>;
  diagnosisDistribution: Array<{ diagnosis: string; count: number }>;
  topMedications: Array<{ name: string; count: number }>;
  revenueByService: Array<{ service: string; revenue: number }>;
  hourlyDistribution: Array<{ hour: string; count: number }>;
  visitDurationDistribution: Array<{ duration: string; count: number }>;
  // New comprehensive metrics
  ageGroups: { [key: string]: number };
  genderDistribution: { [key: string]: number };
  unbilledRevenuePotential: number;
  followUpComplianceRate: number;
  branchPerformance: { [key: string]: { visits: number; revenue: number } };
  newPatients: number;
  returningPatients: number;
  averageVisitsPerPatient: number;
  paymentStatusDistribution: { pending: number; paid: number; overdue: number };
  serviceUtilization: Array<{ name: string; count: number; revenue: number }>;
  patientRetentionRate: number;
  averageRevenuePerVisit: number;
  peakHours: Array<{ hour: string; count: number }>;
  visitCompletionRate: number;
  averageTimeToInvoice: number;
}

// Main Encounters Page Component
const Encounters: React.FC = () => {
  const { practiceId } = usePractice();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeSubTab, setActiveSubTab] = useState<string>('analytics');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [dateFilter, setDateFilter] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  
  const [stats, setStats] = useState<DashboardStats>({
    totalVisits: 0,
    completedVisits: 0,
    pendingVisits: 0,
    todayVisits: 0,
    monthlyVisits: 0,
    lastMonthVisits: 0,
    avgVisitDuration: 25,
    noShowRate: 0,
    pendingLabs: 0,
    completedLabs: 0,
    pendingImaging: 0,
    completedImaging: 0,
    totalPrescriptions: 0,
    totalRevenue: 0,
    medicalAidRevenue: 0,
    patientRevenue: 0,
    providerProductivity: {},
    visitTypes: {},
    departmentDistribution: {},
    monthlyTrends: [],
    diagnosisDistribution: [],
    topMedications: [],
    revenueByService: [],
    hourlyDistribution: [],
    visitDurationDistribution: [],
    // New comprehensive metrics
    ageGroups: {},
    genderDistribution: {},
    unbilledRevenuePotential: 0,
    followUpComplianceRate: 0,
    branchPerformance: {},
    newPatients: 0,
    returningPatients: 0,
    averageVisitsPerPatient: 0,
    paymentStatusDistribution: { pending: 0, paid: 0, overdue: 0 },
    serviceUtilization: [],
    patientRetentionRate: 0,
    averageRevenuePerVisit: 0,
    peakHours: [],
    visitCompletionRate: 0,
    averageTimeToInvoice: 0,
  });

  // Fetch comprehensive statistics
  useEffect(() => {
    if (practiceId) {
      fetchDashboardStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId, dateRange]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Log the practice ID being used
      console.log('Fetching data for practice ID:', practiceId);
      
      // Use fallback practice ID if none provided (New Charm Dental Practice)
      const effectivePracticeId = practiceId || 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
      console.log('Using effective practice ID:', effectivePracticeId);
      
      // Get current month date range from state
      const monthStart = dateRange.start;
      const monthEnd = dateRange.end;
      const lastMonthStart = startOfMonth(subMonths(monthStart, 1));
      const lastMonthEnd = endOfMonth(subMonths(monthStart, 1));

      // Fetch all data in parallel for performance
      const [
        visitsData,
        labsData,
        imagingData,
        medicationsData,
        monthlyTrendsData,
        diagnosisData,
        revenueData,
        medicationUsageData,
        patientDemographicsData,
        branchPerformanceData,
        unbilledVisitsData,
        followUpComplianceData
      ] = await Promise.all([
        // Visits data with patient and branch info
        supabase
          .from('visits')
          .select(`
            *,
            doctor:doctor_id(full_name),
            patient:patient_id(
              id,
              full_name,
              date_of_birth,
              gender
            ),
            branch:branch_id(
              name,
              is_active
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .gte('visit_date', monthStart.toISOString().split('T')[0])
          .lte('visit_date', monthEnd.toISOString().split('T')[0]),
        
        // Lab requests
        supabase
          .from('lab_requests')
          .select('*')
          .eq('practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Imaging requests
        supabase
          .from('imaging_requests')
          .select('*')
          .eq('practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Medications
        supabase
          .from('medications')
          .select('*')
          .eq('practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Monthly trends - get last 12 months
        supabase
          .from('visits')
          .select('visit_date, status, is_cancelled')
          .eq('practice_id', effectivePracticeId)
          .gte('visit_date', format(subMonths(monthEnd, 11), 'yyyy-MM-dd'))
          .lte('visit_date', format(monthEnd, 'yyyy-MM-dd')),
        
        // Diagnosis distribution
        supabase
          .from('visits')
          .select('diagnosis')
          .eq('practice_id', effectivePracticeId)
          .gte('visit_date', monthStart.toISOString().split('T')[0])
          .lte('visit_date', monthEnd.toISOString().split('T')[0])
          .not('diagnosis', 'is', null)
          .not('diagnosis', 'eq', ''),
        
        // Revenue data with service details
        supabase
          .from('invoices_enhanced')
          .select(`
            *,
            invoice_services!inner(
              service_id,
              quantity,
              unit_price,
              total_price,
              practice_service:practice_services(
                name,
                code,
                category
              )
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Medication usage
        supabase
          .from('medications')
          .select('medication_name')
          .eq('practice_id', effectivePracticeId)
          .not('medication_name', 'is', null),
          
        // Patient demographics analysis
        supabase
          .from('patients')
          .select(`
            id,
            date_of_birth,
            gender,
            visits!inner(
              id,
              visit_date,
              status
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .gte('visits.visit_date', monthStart.toISOString().split('T')[0])
          .lte('visits.visit_date', monthEnd.toISOString().split('T')[0]),
          
        // Branch performance data
        supabase
          .from('branches')
          .select(`
            id,
            name,
            is_active,
            visits!inner(
              id,
              visit_date,
              status,
              doctor_id
            )
          `)
          .eq('practice_id', effectivePracticeId)
          .eq('is_active', true)
          .gte('visits.visit_date', monthStart.toISOString().split('T')[0])
          .lte('visits.visit_date', monthEnd.toISOString().split('T')[0]),
          
        // Unbilled visits (completed without invoices)
        supabase
          .from('visits')
          .select(`
            id,
            visit_date,
            patient_id,
            doctor_id
          `)
          .eq('practice_id', effectivePracticeId)
          .eq('status', 'completed')
          .gte('visit_date', monthStart.toISOString().split('T')[0])
          .lte('visit_date', monthEnd.toISOString().split('T')[0]),
          
        // Follow-up compliance
        supabase
          .from('visits')
          .select(`
            id,
            follow_up_required,
            follow_up_date,
            preceding_visit_id
          `)
          .eq('practice_id', effectivePracticeId)
          .not('follow_up_required', 'is', null)
      ]);

      const visits = visitsData.data || [];
      const labs = labsData.data || [];
      const imaging = imagingData.data || [];
      const medications = medicationsData.data || [];
      const invoices = revenueData.data || [];
      const patients = patientDemographicsData.data || [];
      const branches = branchPerformanceData.data || [];
      const unbilledVisits = unbilledVisitsData.data || [];
      const followUps = followUpComplianceData.data || [];

      // Debug logging
      console.log('Visits data:', visits.length, 'visits found');
      console.log('Date range:', monthStart, 'to', monthEnd);
      console.log('Sample visit:', visits[0]);
      console.log('Invoices:', invoices.length, 'invoices found');

      // Calculate basic statistics
      const totalVisits = visits.length;
      const completedVisits = visits.filter(v => v.status === 'completed').length;
      const pendingVisits = visits.filter(v => v.status === 'in-progress' || v.status === 'scheduled').length;
      
      // Fix today's visits calculation
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayVisits = visits.filter(v => v.visit_date === today).length;
      
      const monthlyVisits = visits.length; // Already filtered by date range

      const lastMonthVisits = (monthlyTrendsData.data || []).filter(v => {
        if (!v.visit_date) return false;
        const visitDate = parseISO(v.visit_date);
        return visitDate >= lastMonthStart && visitDate <= lastMonthEnd;
      }).length;

      // Calculate no-show rate
      const cancelledVisits = visits.filter(v => v.is_cancelled).length;
      const noShowRate = totalVisits > 0 ? Math.round((cancelledVisits / totalVisits) * 100) : 0;
      
      // Calculate patient demographics
      const ageGroups = { '0-17': 0, '18-30': 0, '31-50': 0, '51-70': 0, '70+': 0 };
      const genderDistribution = { male: 0, female: 0, other: 0 };
      
      patients.forEach(patient => {
        if (patient.date_of_birth) {
          const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
          if (age < 18) ageGroups['0-17']++;
          else if (age <= 30) ageGroups['18-30']++;
          else if (age <= 50) ageGroups['31-50']++;
          else if (age <= 70) ageGroups['51-70']++;
          else ageGroups['70+']++;
        }
        
        if (patient.gender) {
          genderDistribution[patient.gender.toLowerCase()] = (genderDistribution[patient.gender.toLowerCase()] || 0) + 1;
        }
      });
      
      // Calculate service revenue by category
      const revenueByService: { service: string; revenue: number }[] = [];
      const serviceCategories: { [key: string]: number } = {};
      
      invoices.forEach(invoice => {
        if (invoice.invoice_services) {
          invoice.invoice_services.forEach((service: { practice_service?: { category?: string; name?: string }, total_price?: string, quantity?: number }) => {
            if (service.practice_service) {
              const category = service.practice_service.category || 'Other';
              serviceCategories[category] = (serviceCategories[category] || 0) + parseFloat(service.total_price || '0');
            }
          });
        }
      });
      
      Object.entries(serviceCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([service, revenue]) => {
          revenueByService.push({ service, revenue });
        });
      
      // Calculate unbilled revenue potential
      const unbilledRevenuePotential = unbilledVisits.length * 600; // Average visit cost estimate
      
      // Calculate follow-up compliance rate
      const requiredFollowUps = followUps.filter(v => v.follow_up_required).length;
      const completedFollowUps = followUps.filter(v => v.preceding_visit_id).length;
      const followUpComplianceRate = requiredFollowUps > 0 ? Math.round((completedFollowUps / requiredFollowUps) * 100) : 0;
      
      // Calculate branch performance
      const branchStats: { [key: string]: { visits: number; revenue: number } } = {};
      branches.forEach(branch => {
        if (branch.visits) {
          branchStats[branch.name] = {
            visits: branch.visits.length,
            revenue: 0 // Would need to join with invoices for actual revenue
          };
        }
      });
      
      // Calculate hourly distribution
      const hourlyDistribution: { hour: string; count: number }[] = [];
      const hourCounts: { [key: number]: number } = {};
      
      visits.forEach(visit => {
        if (visit.scheduled_time) {
          const hour = parseInt(visit.scheduled_time.split(':')[0]);
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      });
      
      // Include hours from 7:00 to 18:00 to match the heatmap
      for (let hour = 7; hour <= 18; hour++) {
        hourlyDistribution.push({
          hour: `${hour}:00`,
          count: hourCounts[hour] || 0
        });
      }
      
      // Calculate new vs returning patients
      const newPatients = patients.filter(p => {
        const firstVisit = p.visits?.find(v => v.visit_date);
        return firstVisit && new Date(firstVisit.visit_date) >= monthStart;
      }).length;
      
      const returningPatients = monthlyVisits - newPatients;

      // Lab and imaging stats
      const pendingLabs = labs.filter(l => l.status === 'pending').length;
      const completedLabs = labs.filter(l => l.status === 'completed').length;
      const pendingImaging = imaging.filter(i => i.status === 'pending').length;
      const completedImaging = imaging.filter(i => i.status === 'completed').length;

      // Provider productivity
      const providerProductivity: { [key: string]: number } = {};
      visits.forEach(visit => {
        const doctorName = visit.doctor?.full_name || 'Unknown Provider';
        providerProductivity[doctorName] = (providerProductivity[doctorName] || 0) + 1;
      });

      // Visit types distribution
      const visitTypes: { [key: string]: number } = {};
      visits.forEach(visit => {
        const type = visit.visit_type || 'General Consultation';
        visitTypes[type] = (visitTypes[type] || 0) + 1;
      });

      // Process diagnosis distribution
      const diagnosisCounts: { [key: string]: number } = {};
      (diagnosisData.data || []).forEach(visit => {
        if (visit.diagnosis) {
          diagnosisCounts[visit.diagnosis] = (diagnosisCounts[visit.diagnosis] || 0) + 1;
        }
      });
      
      const diagnosisDistribution = Object.entries(diagnosisCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([diagnosis, count]) => ({ diagnosis, count }));

      // Process monthly trends
      const monthlyTrends: Array<{ month: string; totalVisits: number; completedVisits: number; cancelledVisits: number }> = [];
      
      // Group visits by month
      const visitsByMonth: { [key: string]: Array<{ visit_date?: string; status?: string; is_cancelled?: boolean }> } = {};
      (monthlyTrendsData.data || []).forEach(visit => {
        if (visit.visit_date) {
          const monthKey = format(parseISO(visit.visit_date), 'yyyy-MM');
          if (!visitsByMonth[monthKey]) visitsByMonth[monthKey] = [];
          visitsByMonth[monthKey].push(visit);
        }
      });
      
      // Generate trends for last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = subMonths(monthEnd, i);
        const monthKey = format(date, 'yyyy-MM');
        const monthVisits = visitsByMonth[monthKey] || [];
        
        monthlyTrends.push({
          month: format(date, 'MMM yyyy'),
          totalVisits: monthVisits.length,
          completedVisits: monthVisits.filter(v => v.status === 'completed').length,
          cancelledVisits: monthVisits.filter(v => v.is_cancelled).length
        });
      }

      // Process medication data
      const medicationCounts: { [key: string]: number } = {};
      (medicationUsageData.data || []).forEach(med => {
        if (med.medication_name) {
          medicationCounts[med.medication_name] = (medicationCounts[med.medication_name] || 0) + 1;
        }
      });
      
      const topMedications = Object.entries(medicationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Calculate revenue
      const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
      const medicalAidRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.medical_aid_total) || 0), 0);
      const patientRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.patient_total) || 0), 0);

      // Mock department distribution (since it's not in the database)
      const departmentDistribution = {
        'General Practice': 40,
        'Dental': 30,
        'Specialist': 20,
        'Emergency': 10,
      };

      // Mock visit duration distribution
      const visitDurationDistribution = [
        { duration: '0-15 min', count: 15 },
        { duration: '15-30 min', count: 45 },
        { duration: '30-45 min', count: 25 },
        { duration: '45-60 min', count: 10 },
        { duration: '60+ min', count: 5 },
      ];

      // Calculate additional comprehensive metrics
      const averageVisitsPerPatient = patients.length > 0 ? Math.round(totalVisits / patients.length * 10) / 10 : 0;
      const visitCompletionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
      const averageRevenuePerVisit = completedVisits > 0 ? Math.round(totalRevenue / completedVisits) : 0;
      
      // Calculate patient retention rate (patients with >1 visit)
      const patientsWithMultipleVisits = patients.filter(p => p.visits && p.visits.length > 1).length;
      const patientRetentionRate = patients.length > 0 ? Math.round((patientsWithMultipleVisits / patients.length) * 100) : 0;
      
      // Payment status distribution
      const paymentStatusDistribution = {
        pending: invoices.filter(i => i.payment_status === 'pending').length,
        paid: invoices.filter(i => i.payment_status === 'paid').length,
        overdue: invoices.filter(i => i.payment_status === 'overdue').length
      };
      
      // Service utilization with counts and revenue
      const serviceUtilizationMap: { [key: string]: { count: number; revenue: number } } = {};
      invoices.forEach(invoice => {
        if (invoice.invoice_services) {
          invoice.invoice_services.forEach((service: { practice_service?: { category?: string; name?: string }, total_price?: string, quantity?: number }) => {
            if (service.practice_service) {
              const name = service.practice_service.name;
              if (!serviceUtilizationMap[name]) {
                serviceUtilizationMap[name] = { count: 0, revenue: 0 };
              }
              serviceUtilizationMap[name].count += service.quantity || 1;
              serviceUtilizationMap[name].revenue += parseFloat(service.total_price || '0');
            }
          });
        }
      });
      
      const serviceUtilization = Object.entries(serviceUtilizationMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 15);
      
      // Calculate average time to invoice (mock data for now)
      const averageTimeToInvoice = 2.5; // days
      
      // Peak hours (top 3 busiest hours)
      const peakHours = hourlyDistribution
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Generate daily visits data for the chart
      const dailyVisitsData: Array<{ date: string; fullDate: string; visits: number; completed: number; cancelled: number }> = [];
      const visitsByDate: { [key: string]: { total: number; completed: number; cancelled: number } } = {};
      
      visits.forEach(visit => {
        if (visit.visit_date) {
          const dateKey = visit.visit_date;
          if (!visitsByDate[dateKey]) {
            visitsByDate[dateKey] = { total: 0, completed: 0, cancelled: 0 };
          }
          visitsByDate[dateKey].total++;
          if (visit.status === 'completed') visitsByDate[dateKey].completed++;
          if (visit.is_cancelled) visitsByDate[dateKey].cancelled++;
        }
      });
      
      // Convert to array format for the chart
      Object.entries(visitsByDate).forEach(([date, counts]) => {
        dailyVisitsData.push({
          date: format(parseISO(date), 'MMM dd'),
          fullDate: date,
          visits: counts.total,
          completed: counts.completed,
          cancelled: counts.cancelled
        });
      });
      
      // Sort by date
      dailyVisitsData.sort((a, b) => a.fullDate.localeCompare(b.fullDate));

      setStats({
        totalVisits,
        completedVisits,
        pendingVisits,
        todayVisits,
        monthlyVisits,
        lastMonthVisits,
        avgVisitDuration: 25,
        noShowRate,
        pendingLabs,
        completedLabs,
        pendingImaging,
        completedImaging,
        totalPrescriptions: medications.length,
        totalRevenue,
        medicalAidRevenue,
        patientRevenue,
        providerProductivity,
        visitTypes,
        departmentDistribution,
        monthlyTrends,
        diagnosisDistribution,
        topMedications,
        revenueByService,
        hourlyDistribution,
        visitDurationDistribution,
        // New comprehensive metrics
        ageGroups,
        genderDistribution,
        unbilledRevenuePotential,
        followUpComplianceRate,
        branchPerformance: branchStats,
        newPatients,
        returningPatients,
        averageVisitsPerPatient,
        paymentStatusDistribution,
        serviceUtilization,
        patientRetentionRate,
        averageRevenuePerVisit,
        peakHours,
        visitCompletionRate,
        averageTimeToInvoice,
        dailyVisits: dailyVisitsData
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabIcons = {
    overview: "solar:chart-square-bold-duotone",
    visits: "solar:clipboard-list-bold-duotone",
    clinical: "solar:health-bold-duotone",
    operations: "solar:settings-minimalistic-bold-duotone",
  };
  
  const handleDateFilterChange = (filter: '30d' | '3m' | '6m' | '12m') => {
    setDateFilter(filter);
    const end = new Date();
    let start = new Date();
    
    switch (filter) {
      case '30d':
        start = subMonths(end, 1);
        break;
      case '3m':
        start = subMonths(end, 3);
        break;
      case '6m':
        start = subMonths(end, 6);
        break;
      case '12m':
        start = subMonths(end, 12);
        break;
    }
    
    setDateRange({ start, end });
  };

  // Handle date range changes from the dashboard
  const handleDashboardDateRangeChange = useCallback((newRange: { start: Date; end: Date }) => {
    setDateRange(newRange);
    // Update the date filter button to reflect custom range
    const daysDiff = Math.ceil((newRange.end.getTime() - newRange.start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 30) setDateFilter('30d');
    else if (daysDiff <= 90) setDateFilter('3m');
    else if (daysDiff <= 180) setDateFilter('6m');
    else setDateFilter('12m');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header Section - Clean Professional Style */}
        <div className="rounded-xl">
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
                  <Icon icon="solar:clipboard-list-bold-duotone" className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">Encounters</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Real-time practice analytics and insights</p>
                </div>
              </div>
              
              {/* Date Filter and Avatar */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  {(['30d', '3m', '6m', '12m'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => handleDateFilterChange(filter)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        dateFilter === filter
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {filter === '30d' ? '30 Days' : filter === '3m' ? '3 Months' : filter === '6m' ? '6 Months' : '1 Year'}
                    </button>
                  ))}
                </div>
                
                <div className="relative">
                  <button className="relative group focus:outline-none">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm group-hover:scale-105 transition-transform duration-200">
                      <img 
                        src={user?.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`} 
                        alt={user?.name || 'User'} 
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tab Navigation - Professional Style */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-4 gap-0 w-full">
            {(['overview', 'visits', 'clinical', 'operations'] as const).map((tab) => {
              const iconName = tabIcons[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize min-h-[60px] ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={iconName} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="truncate text-center sm:text-left">{tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Sub-tabs for Overview */}
                <Card className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                  <CardContent className="p-4">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                      {(['analytics', 'performance', 'insights', 'trends'] as const).map((subTab) => {
                        const isActiveSubTab = activeSubTab === subTab;
                        return (
                          <button
                            key={subTab}
                            onClick={() => setActiveSubTab(subTab)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                              isActiveSubTab
                                ? 'bg-white text-cyan-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <Icon 
                              icon={
                                subTab === 'analytics' ? 'solar:chart-square-bold-duotone' :
                                subTab === 'performance' ? 'solar:speedometer-bold-duotone' :
                                subTab === 'insights' ? 'solar:lightbulb-bolt-bold-duotone' :
                                'solar:graph-up-bold-duotone'
                              } 
                              className="w-4 h-4" 
                            />
                            <span className="capitalize">{subTab}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                
                <AdvancedEncountersDashboard 
                  stats={stats} 
                  dateRange={dateRange} 
                  onDateRangeChange={handleDashboardDateRangeChange}
                  activeSubTab={activeSubTab}
                />
              </motion.div>
            )}
            
            {activeTab === 'visits' && (
              <motion.div
                key="visits"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        <Icon icon="solar:clipboard-list-bold-duotone" className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Visit Management</CardTitle>
                        <p className="text-sm text-gray-500">Schedule and manage patient visits</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Icon icon="solar:calendar-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Visit scheduling interface coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {activeTab === 'clinical' && (
              <motion.div
                key="clinical"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Laboratory Management */}
                  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <Icon icon="solar:test-tube-bold-duotone" className="w-5 h-5 text-emerald-600" />
                        </div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Laboratory</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <LaboratoryTabContent />
                    </CardContent>
                  </Card>
                  
                  {/* Imaging Management */}
                  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Icon icon="solar:scan-bold-duotone" className="w-5 h-5 text-purple-600" />
                        </div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Imaging</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ImagingTabContent />
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'operations' && (
              <motion.div
                key="operations"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <FollowUpAutomationTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Encounters;