import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { usePractice } from '../contexts/PracticeContext';
import { useAuthStore } from '../stores/authStore';
import { startOfMonth, endOfMonth, subMonths, parseISO, format } from 'date-fns';

// Import existing components
import LaboratoryTabContent from '../components/requests/LaboratoryTabContent';
import ImagingTabContent from '../components/requests/ImagingTabContent';
import FollowUpAutomationTab from '../components/encounters/FollowUpAutomationTab';
import { AdvancedEncountersDashboard } from '../components/encounters/AdvancedEncountersDashboard';
import { EncountersView } from '../components/encounters/EncountersView';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';

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
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('analytics');
  const [activeSubTab] = useState<string>('analytics');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: subMonths(new Date(), 1), // Last 30 days by default
    end: new Date()
  });
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  
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
      
      // Check authentication first
      const { data: authData, error: authError } = await supabase.auth.getUser();
      console.log('Auth status:', authData.user?.id ? 'Authenticated' : 'Not authenticated');
      if (authError) {
        console.warn('Auth check error:', authError);
      }
      
      // Get current month date range from state
      const monthStart = dateRange.start;
      const monthEnd = dateRange.end;
      
      // Log the practice ID being used
      console.log('Fetching data for practice ID:', practiceId, typeof practiceId);
      
      // Use fallback practice ID if none provided (New Charm Dental Practice)
      const effectivePracticeId = practiceId || 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
      console.log('Using effective practice ID:', effectivePracticeId);
      console.log('Date range being used:', monthStart.toISOString().split('T')[0], 'to', monthEnd.toISOString().split('T')[0]);
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
        (() => {
          let query = supabase
            .from('visits')
            .select(`
              *,
              doctor:doctor_id(full_name),
              patient:patients!visits_patient_id_fkey(
                id,
                first_name,
                last_name,
                date_of_birth,
                gender
              ),
              branch:branch_id(
                name,
                is_active
              )
            `);
          
          // Handle practice_id filtering - include null if no practice context
          if (practiceId) {
            query = query.eq('practice_id', effectivePracticeId);
          } else {
            // If no practice ID from context, get all visits for development
            query = query.or(`practice_id.eq.${effectivePracticeId},practice_id.is.null`);
          }
          
          return query
            .gte('visit_date', monthStart.toISOString().split('T')[0])
            .lte('visit_date', monthEnd.toISOString().split('T')[0]);
        })(),
        
        // Lab requests
        supabase
          .from('lab_requests')
          .select('*')
          .eq('practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Imaging requests (filter through visit relationship)
        supabase
          .from('imaging_requests')
          .select(`
            *,
            visit:visit_id!inner(practice_id)
          `)
          .eq('visit.practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Medications (filter through visit relationship)
        supabase
          .from('medications')
          .select(`
            *,
            visit:visit_id!inner(practice_id)
          `)
          .eq('visit.practice_id', effectivePracticeId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Monthly trends - get last 12 months
        (() => {
          let query = supabase
            .from('visits')
            .select('visit_date, status, is_cancelled');
          
          if (practiceId) {
            query = query.eq('practice_id', effectivePracticeId);
          } else {
            query = query.or(`practice_id.eq.${effectivePracticeId},practice_id.is.null`);
          }
          
          return query
            .gte('visit_date', format(subMonths(monthEnd, 11), 'yyyy-MM-dd'))
            .lte('visit_date', format(monthEnd, 'yyyy-MM-dd'));
        })(),
        
        // Diagnosis distribution
        (() => {
          let query = supabase
            .from('visits')
            .select('diagnosis');
          
          if (practiceId) {
            query = query.eq('practice_id', effectivePracticeId);
          } else {
            query = query.or(`practice_id.eq.${effectivePracticeId},practice_id.is.null`);
          }
          
          return query
            .gte('visit_date', monthStart.toISOString().split('T')[0])
            .lte('visit_date', monthEnd.toISOString().split('T')[0])
            .not('diagnosis', 'is', null)
            .not('diagnosis', 'eq', '');
        })(),
        
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
        
        // Medication usage (filter through visit relationship)
        supabase
          .from('medications')
          .select(`
            medication_name,
            visit:visit_id!inner(practice_id)
          `)
          .eq('visit.practice_id', effectivePracticeId)
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
        (() => {
          let query = supabase
            .from('visits')
            .select(`
              id,
              visit_date,
              patient_id,
              doctor_id
            `);
          
          if (practiceId) {
            query = query.eq('practice_id', effectivePracticeId);
          } else {
            query = query.or(`practice_id.eq.${effectivePracticeId},practice_id.is.null`);
          }
          
          return query
            .eq('status', 'completed')
            .gte('visit_date', monthStart.toISOString().split('T')[0])
            .lte('visit_date', monthEnd.toISOString().split('T')[0]);
        })(),
          
        // Follow-up compliance
        (() => {
          let query = supabase
            .from('visits')
            .select(`
              id,
              follow_up_required,
              follow_up_date,
              preceding_visit_id
            `);
          
          if (practiceId) {
            query = query.eq('practice_id', effectivePracticeId);
          } else {
            query = query.or(`practice_id.eq.${effectivePracticeId},practice_id.is.null`);
          }
          
          return query.not('follow_up_required', 'is', null);
        })()
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
      console.log('=== QUERY RESULTS DEBUG ===');
      console.log('Visits data:', visits.length, 'visits found');
      console.log('Visits query error:', visitsData.error);
      console.log('Labs data:', labs.length, 'labs found');
      console.log('Labs query error:', labsData.error);
      console.log('Imaging data:', imaging.length, 'imaging found');  
      console.log('Imaging query error:', imagingData.error);
      console.log('Medications data:', medications.length, 'medications found');
      console.log('Medications query error:', medicationsData.error);
      console.log('Invoices data:', invoices.length, 'invoices found');
      console.log('Invoices query error:', revenueData.error);
      console.log('');
      console.log('Date range:', monthStart, 'to', monthEnd);
      console.log('Effective practice ID:', effectivePracticeId);
      console.log('Sample visit:', visits[0]);

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
        dailyVisits: dailyVisitsData,
        rawVisitData: visits.map(visit => ({
          id: visit.id,
          visit_date: visit.visit_date,
          status: visit.status,
          scheduled_time: visit.scheduled_time,
          branch_id: visit.branch_id,
          patient: visit.patient ? {
            gender: visit.patient.gender,
            date_of_birth: visit.patient.date_of_birth
          } : undefined
        }))
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabIcons = {
    analytics: "solar:chart-square-bold-duotone",
    encounters: "solar:document-text-bold-duotone",
    automations: "solar:settings-minimalistic-bold-duotone",
  };
  

  // Handle date range changes from the dashboard
  const handleDashboardDateRangeChange = useCallback((newRange: { start: Date; end: Date }) => {
    setDateRange(newRange);
  }, []);
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

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
              
              {/* User Avatar with Dropdown - Same as Dashboard */}
              {user && (
                <div className="relative">
                  <button
                    ref={avatarButtonRef}
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    className="relative group focus:outline-none"
                  >
                    {/* Pulsating outer ring */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full opacity-50"></div>
                    
                    {/* Avatar circle */}
                    <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                      <img 
                        src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                        alt={user.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`;
                        }}
                      />
                    </div>
                  </button>

                  {/* Premium Dropdown Modal - Using Portal for maximum z-index control */}
                  {isAvatarDropdownOpen && createPortal(
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] animate-in fade-in duration-200" 
                        onClick={() => setIsAvatarDropdownOpen(false)}
                      />
                      
                      {/* Premium Modal Dropdown */}
                      <div 
                        style={{
                          position: 'fixed',
                          top: avatarButtonRef.current ? avatarButtonRef.current.getBoundingClientRect().bottom + 16 : 0,
                          right: avatarButtonRef.current ? window.innerWidth - avatarButtonRef.current.getBoundingClientRect().right : 0,
                          zIndex: 99999
                        }}
                        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px] animate-in fade-in slide-in-from-top-3 duration-300"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
                          <button 
                            onClick={() => setIsAvatarDropdownOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>
                        
                        {/* User Info Card */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img 
                                  src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                                  alt={user.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white mt-1">
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Logout Button */}
                        <button
                          onClick={() => {
                            setIsAvatarDropdownOpen(false);
                            handleLogout();
                          }}
                          className="w-full px-4 py-3 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl transition-colors font-semibold hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:logout-3-bold-duotone" className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Tab Navigation - Professional Style */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-3 gap-0 w-full">
            {(['analytics', 'encounters', 'automations'] as const).map((tab) => {
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
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
 
                
                <AdvancedEncountersDashboard 
                  stats={stats} 
                  dateRange={dateRange} 
                  onDateRangeChange={handleDashboardDateRangeChange}
                  activeSubTab={activeSubTab}
                />
              </motion.div>
            )}
            
            {activeTab === 'encounters' && (
              <motion.div
                key="encounters"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EncountersView />
              </motion.div>
            )}
            

            {activeTab === 'automations' && (
              <motion.div
                key="automations"
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
      
      {/* Floating Visit Tracker - Same as Dashboard */}
      {practiceId && <FloatingVisitTracker practiceId={practiceId} selectedDate={new Date()} />}
    </div>
  );
};

export default Encounters;