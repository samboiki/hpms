import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Card, CardContent } from '../components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'react-hot-toast';
import { FinanceHeader } from '../components/finance/FinanceHeader';
import { FinanceTabBar, type FinanceTab } from '../components/finance/FinanceTabBar';
import { FinanceTabContent } from '../components/finance/FinanceTabContent';
import { useFinancePage } from '../components/finance/useFinancePage';
import ClaimsBatches from '../components/finance/claims/ClaimsBatches';
import { useSearchParams } from 'react-router-dom';

const FINANCE_TABS: readonly FinanceTab[] = ['overview', 'invoicing', 'payments', 'ledgers', 'reports', 'batch-management'];

interface BatchData {
  batch_id: string;
  practice_number: string;
  batch_number: string;
  batch_date: string;
  medical_aid_reference: string;
  status: string;
  total_invoices: number;
  total_amount: number;
  created_at: string;
  sent_at: string | null;
  confirmed_at: string | null;
  medical_aid_name: string;
  medical_aid_short_name: string;
  medical_aid_email: string;
  medical_aid_logo_url: string;
  medical_aid_theme_color: string;
  practice_name: string;
  practice_email: string;
  detail_transactions: number;
  total_detail_transactions: number;
  total_amount_detail_transactions: number;
  dat_filename: string;
}

// Heartbeat animation styles
const heartbeatStyles = `
  @keyframes heartbeat {
    0% { transform: scale(1); }
    14% { transform: scale(1.15); }
    28% { transform: scale(1); }
    42% { transform: scale(1.15); }
    70% { transform: scale(1); }
  }
  .heartbeat-ring {
    animation: heartbeat 1.5s infinite;
  }
`;

// Medical aid theme colors mapping
const MEDICAL_AID_THEMES: Record<string, string> = {
  'MAG1': '#76a5af',
  'NAMM': '#ee5a60', 
  'NHPM': '#50caf0',
  'NMC1': '#1f97d5',
  'PROS': '#9c8f6c'
};

// Utility functions for color manipulation
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const lightenColor = (hex: string, percent: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const Finance: React.FC = () => {
  const { user, selectedPracticeId } = useAuthStore();
  
  // Inject heartbeat animation styles
  React.useEffect(() => {
    const styleId = 'heartbeat-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = heartbeatStyles;
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Links such as /finance?tab=batch-management open that tab directly
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as FinanceTab | null;
  const [activeTab, setActiveTab] = useState<FinanceTab>(
    requestedTab && FINANCE_TABS.includes(requestedTab) ? requestedTab : 'overview'
  );
  // Every finance figure is scoped to the selected practice (super admins) or the user's own
  const financePracticeId = selectedPracticeId || user?.practice_id || null;
  const financePage = useFinancePage(financePracticeId);
  const practiceName = (financePracticeId && financePracticeId === user?.practice_id && user?.practices?.name) || 'HPMS practice';
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchFilters, setBatchFilters] = useState<{paid: boolean, unpaid: boolean, active: boolean}>({
    paid: false,
    unpaid: false, 
    active: true
  });
  const [submittingBatches, setSubmittingBatches] = useState<Set<string>>(new Set());
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const isFetchingBatchDataRef = useRef(false);
  const [selectedBatchForDetails, setSelectedBatchForDetails] = useState<BatchData | null>(null);
  const [batchDetailsData, setBatchDetailsData] = useState<any[]>([]);
  const [loadingBatchDetails, setLoadingBatchDetails] = useState(false);

  // Fetch batch management data
  const fetchBatchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingBatchDataRef.current) {
      console.log('⏳ Already fetching batch data, skipping...');
      return;
    }
    
    isFetchingBatchDataRef.current = true;
    console.log('🔍 fetchBatchData called');
    console.log('📍 selectedPracticeId:', selectedPracticeId);
    console.log('👤 user:', user);
    console.log('🏥 user.practice_id:', user?.practice_id);
    
    // Use selectedPracticeId or fallback to user's practice_id
    const practiceId = selectedPracticeId || user?.practice_id;
    
    if (!practiceId) {
      console.warn('❌ No practice ID found (neither selectedPracticeId nor user.practice_id)');
      console.log('🔧 Available user fields:', user ? Object.keys(user) : 'No user');
      
      // For super admins or users without practice ID, try to get the first available practice
      if (user?.is_super_admin) {
        console.log('🔧 User is super admin, trying to get first practice...');
        try {
          const { data: practices, error } = await supabase
            .from('practices')
            .select('id, name')
            .limit(1);
          
          if (!error && practices && practices.length > 0) {
            const firstPracticeId = practices[0].id;
            console.log('✅ Using first practice:', firstPracticeId, practices[0].name);
            // Continue with this practice ID
            await fetchBatchDataForPractice(firstPracticeId);
            return;
          } else {
            console.log('❌ No practices found in database');
          }
        } catch (error) {
          console.error('❌ Error fetching practices:', error);
        }
      }
      
      // Set empty batches and return
      setBatches([]);
      isFetchingBatchDataRef.current = false;
      return;
    }
    
    await fetchBatchDataForPractice(practiceId);
    isFetchingBatchDataRef.current = false;
  }, [selectedPracticeId, user?.practice_id, user?.is_super_admin]); // Only depend on stable values

  // Helper function to fetch batch data for a specific practice
  const fetchBatchDataForPractice = async (practiceId: string) => {
    console.log('✅ Using practice ID:', practiceId);
    
    setBatchLoading(true);
    try {
      // Method 1: Try using the simple RPC function (best compatibility)
      console.log('🔍 Attempting to use get_practice_batches_simple function...');
      try {
        const { data: simpleData, error: simpleRpcError } = await supabase
          .rpc('get_practice_batches_simple', { 
            p_practice_id: practiceId 
          });
        
        if (!simpleRpcError && simpleData && simpleData.length > 0) {
          console.log('✅ Successfully fetched batches using simple RPC function');
          console.log('📊 Found batches count:', simpleData.length);
          setBatches(simpleData);
          return;
        } else if (simpleRpcError) {
          console.log('⚠️ get_practice_batches_simple RPC error:', simpleRpcError.message);
        }
      } catch (simpleRpcErr) {
        console.log('⚠️ Simple RPC function not available, trying with doctors...');
      }

      // Method 2: Try using the detailed RPC function with doctor info
      console.log('🔍 Attempting to use get_practice_batches_with_doctors function...');
      try {
        const { data: doctorData, error: doctorRpcError } = await supabase
          .rpc('get_practice_batches_with_doctors', { 
            p_practice_id: practiceId 
          });
        
        if (!doctorRpcError && doctorData && doctorData.length > 0) {
          console.log('✅ Successfully fetched batches using doctor RPC function');
          console.log('📊 Found batches count:', doctorData.length);
          setBatches(doctorData);
          return;
        } else if (doctorRpcError) {
          console.log('⚠️ get_practice_batches_with_doctors RPC error:', doctorRpcError.message);
        }
      } catch (doctorRpcErr) {
        console.log('⚠️ Doctor RPC function not available, falling back to original...');
      }

      // Method 3: Try the original RPC functions as fallback
      console.log('🔍 Attempting to use get_practice_batches function...');
      try {
        const { data: batchData, error: rpcError } = await supabase
          .rpc('get_practice_batches', { 
            p_practice_id: practiceId 
          });
        
        if (!rpcError && batchData && batchData.length > 0) {
          console.log('✅ Successfully fetched batches using original RPC function');
          console.log('📊 Found batches count:', batchData.length);
          setBatches(batchData);
          return;
        } else if (rpcError) {
          console.log('⚠️ get_practice_batches RPC error:', rpcError.message);
        }
      } catch (rpcErr) {
        console.log('⚠️ Original RPC function not available, trying direct...');
      }
      
      // Method 4: Fallback to practice number lookup and view query
      console.log('🏥 Fetching practice data for ID:', practiceId);
      
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('id, name, practice_number')
        .eq('id', practiceId)
        .single();

      if (practiceError) {
        console.error('❌ Practice query error:', practiceError);
        
        // Method 5: Try direct batch_headers query by practice_id
        console.log('🔄 Trying direct batch_headers query by practice_id...');
        const { data: directBatches, error: directError } = await supabase
          .from('batch_headers')
          .select(`
            *,
            medical_aid_providers (
              name,
              short_name,
              email,
              logo_url,
              theme_color
            ),
            practices (
              name,
              contact_email
            )
          `)
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false });
        
        if (!directError && directBatches && directBatches.length > 0) {
          console.log('✅ Found batches using direct query:', directBatches.length);
          
          // Transform to match the view structure
          const transformedBatches = directBatches.map(batch => ({
            batch_id: batch.id,
            practice_number: batch.practice_number,
            batch_number: batch.batch_number,
            batch_date: batch.batch_date,
            medical_aid_reference: batch.medical_aid_reference,
            status: batch.status,
            total_invoices: batch.total_invoices || 0,
            total_amount: batch.total_amount || 0,
            created_at: batch.created_at,
            sent_at: batch.sent_at,
            confirmed_at: batch.confirmed_at,
            medical_aid_name: batch.medical_aid_providers?.name || 'Unknown Medical Aid',
            medical_aid_short_name: batch.medical_aid_providers?.short_name || 'UNK',
            medical_aid_email: batch.medical_aid_providers?.email || 'unknown@example.com',
            medical_aid_logo_url: batch.medical_aid_providers?.logo_url,
            medical_aid_theme_color: batch.medical_aid_providers?.theme_color,
            practice_name: batch.practices?.name || 'Unknown Practice',
            practice_email: batch.practices?.contact_email || 'unknown@example.com',
            detail_transactions: 0, // Would need separate query
            total_detail_transactions: 0,
            total_amount_detail_transactions: 0,
            dat_filename: `${batch.practice_number || 'UNKNOWN'}_1_${batch.medical_aid_reference}` // Will be recalculated with proper sequence
          }));
          
          setBatches(transformedBatches);
          return;
        }
        
        console.log('❌ No batches found via direct query, checking system-wide...');
      } else {
        console.log('🏥 Practice found:', practiceData);
        
        // Method 6: Query using practice_number if available
        if (practiceData.practice_number) {
          console.log('🔍 Querying batches with practice_number:', practiceData.practice_number);
          
          const { data: batchData, error: batchError } = await supabase
            .from('batch_management_view')
            .select('*')
            .eq('practice_number', practiceData.practice_number)
            .order('created_at', { ascending: false });
          
          if (!batchError && batchData && batchData.length > 0) {
            console.log('✅ Found batches via practice_number:', batchData.length);
            setBatches(batchData);
            return;
          }
          
          if (batchError) {
            console.error('❌ Batch view query error:', batchError);
          }
        }
      }
      
      // Method 7: Final fallback - check if there are any batches in the system
      console.log('🔍 Checking for any batches in the system...');
      const { data: anyBatches, count } = await supabase
        .from('batch_management_view')
        .select('*', { count: 'exact', head: false })
        .limit(10);
      
      console.log('📊 Total batches in system:', count);
      console.log('📋 Sample batches:', anyBatches);
      
      if (anyBatches && anyBatches.length > 0) {
        console.log('⚠️ Found batches in system but none for this practice');
        console.log('🔧 Consider checking practice_number mapping');
      } else {
        console.log('ℹ️ No batches found in the entire system - this is normal for new installations');
      }
      
      setBatches([]);
      
    } catch (error) {
      console.error('❌ Error fetching batch data:', error);
      setBatches([]);
    } finally {
      setBatchLoading(false);
    }
  };

  // --- Function to handle individual batch submission ---
  const handleIndividualSubmit = async (batchId: string) => {
    // Show a loading spinner for this specific button
    setSubmittingBatches(prev => new Set(prev).add(batchId));
    try {
      console.log(`🚀 Invoking Edge Function 'send-batch-email' for batch: ${batchId}`);
      
      const { data, error } = await supabase.functions.invoke('send-batch-email', {
        body: { batchId },
      });

      if (error) {
        throw new Error((error as any).message);
      }
      
      console.log('✅ Success:', data.message);
      toast.success(`Success: ${data.message}`);

      // Refresh the batch list to show the new 'sent' status
      fetchBatchData();

    } catch (error) {
      console.error(`❌ Failed to send batch ${batchId}:`, error);
      
      // Try to get more detailed error information
      let errorMessage = 'Unknown error occurred';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = (error as any).message;
        } else if ('error' in error) {
          errorMessage = (error as any).error;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }
      
      console.log('📋 Full error details:', {
        error,
        message: errorMessage,
        batchId
      });
      
      toast.error(`Error submitting batch: ${errorMessage}`);
    } finally {
      // Remove the loading spinner for this button
      setSubmittingBatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(batchId);
        return newSet;
      });
    }
  };

  // --- Function to handle submitting all active batches ---
  const handleSubmitAll = async () => {
    const activeBatchesToSubmit = batches.filter(batch => batch.status === 'active');

    if (activeBatchesToSubmit.length === 0) {
      toast.error("No active batches to submit.");
      return;
    }

    setIsSubmittingAll(true);
    
    // Attempt all submissions, even if some fail
    await Promise.allSettled(
      activeBatchesToSubmit.map(batch => handleIndividualSubmit(batch.batch_id))
    );

    setIsSubmittingAll(false);

    toast.success(`"Submit All" process complete. Please check the status of individual batches.`);
    
    // Refresh data after all submissions are attempted
    fetchBatchData();
  };

  // --- ROBUST Function to handle downloading .dat file (June 2025 Format) ---
  const handleDownloadDat = async (batch: BatchData) => {
    try {
      console.log('🔄 Starting .dat file generation for batch:', batch.batch_id);
      
      // Use the database function that generates the correct format
      const { data, error } = await supabase.rpc('prepare_batch_for_sending', {
        p_batch_id: batch.batch_id
      });

      if (error) {
        console.error('❌ Database error:', error);
        // Fallback to manual generation if function doesn't exist
        return handleDownloadDatManual(batch);
      }

      if (!data || data.length === 0) {
        toast.error('Could not build the claim file: the batch returned no data.');
        return;
      }

      const { file_content, file_name } = data[0];
      
      if (!file_content) {
        toast.error('Could not build the claim file: the file came back empty.');
        return;
      }

      console.log(`📄 Generated .dat file: ${file_name}`);
      
      // Replace escaped newlines with actual newlines
      const cleanedContent = file_content.replace(/\\n/g, '\n');

      // Create and download the file with .dat extension
      const blob = new Blob([cleanedContent], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Ensure .dat extension is always used
      let downloadFileName = file_name || `${batch.dat_filename}.dat`;
      // If filename doesn't end with .dat, add it
      if (!downloadFileName.toLowerCase().endsWith('.dat')) {
        downloadFileName = downloadFileName.replace(/\.[^/.]+$/, '') + '.dat';
      }
      
      a.download = downloadFileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      toast.success(`✅ Downloaded ${file_name || batch.dat_filename}`);

    } catch (error: any) {
      console.error('❌ Error generating .dat file:', error);
      toast.error(error.message || 'Failed to generate .dat file');
    }
  };

  // Manual fallback function with new naming convention: practicenumber_sequence_provider
  const handleDownloadDatManual = async (batch: BatchData) => {
    try {
      console.log('📋 Using manual .dat generation with new naming convention');
      
      const { data: batchDetails, error: batchError } = await supabase
        .from('batch_details')
        .select('*')
        .eq('batch_header_id', batch.batch_id)
        .order('transaction_number_in_batch', { ascending: true });

      if (batchError) throw batchError;
      if (!batchDetails || batchDetails.length === 0) {
        toast.error('This batch has no claim lines, so there is no file to download.');
        return;
      }

      // Get batch trailer for accurate totals
      const { data: trailer } = await supabase
        .from('batch_trailer')
        .select('*')
        .eq('batch_header_id', batch.batch_id)
        .single();

      // Calculate sequence number: count of batches sent before this one for same practice/provider
      const { data: sequenceData } = await supabase
        .from('batch_submissions')
        .select(`
          batch_headers!inner(
            practice_number,
            medical_aid_reference,
            sent_at
          )
        `)
        .eq('batch_headers.practice_number', batch.practice_number)
        .eq('batch_headers.medical_aid_reference', batch.medical_aid_reference)
        .not('sent_at', 'is', null)
        .lt('sent_at', new Date().toISOString());

      const sequenceNumber = (sequenceData?.length || 0) + 1;

      let datContent = '';
      
      // Header line (exact format from June 2025)
      // Format: 1,practice_number,batch_number,D,detail_count,date,medical_aid_name,batch_total_no_decimal,version
      const headerDate = format(new Date(batch.batch_date), 'yyyyMMdd');
      datContent += `1,${batch.practice_number},1,D,${batch.total_invoices},${headerDate},ONEHEALTH,2.1,1.6\n`;
      
      // Detail lines (D records) - exact comma-separated format
      batchDetails.forEach((detail: any) => {
        const fields = [
          'D',                                                    // Record type
          detail.record_number || detail.transaction_number_in_batch || '',
          detail.invoice_number || '',
          detail.not_used_1 || '',
          detail.tariff_code_type || 'T',
          detail.medical_aid_reference || '',
          detail.medical_aid_plan || '',
          detail.medical_aid_membership_number || '',
          detail.member_surname || '',
          detail.member_initials || '',
          detail.patient_name || '',
          detail.patient_date_of_birth || '',  // Already YYYYMMDD
          detail.bhf_tariff_code || '',
          (parseFloat(detail.service_amount || 0) * 100).toFixed(0), // Amount without decimal
          detail.tariff_description || '',
          (parseFloat(detail.discount_amount || 0) * 100).toFixed(0),
          detail.service_date || '',           // Already YYYYMMDD
          detail.number_of_services || '1.00',
          detail.service_fee || '7',
          detail.modifier_1 || '',
          detail.modifier_2 || '',
          detail.modifier_3 || '',
          detail.modifier_4 || '',
          detail.invoice_number || '',
          detail.referring_doctor || '',
          detail.nappi_code || '',
          detail.referred_to_practice_number || '',
          detail.not_used_2 || '',
          detail.practice_number || '',
          detail.hospital_indicator || '',
          detail.authorisation_number || '',
          detail.resubmission_flag || '',
          detail.diagnostic_code || '',
          detail.diagnostic_code_type || 'D',
          detail.dosage_description || '',
          detail.not_used_3 || '',
          detail.treating_doctor_hpcsa_number || '',
          detail.tooth_numbers || '',
          detail.gender || '',
          detail.tariff_code_type || 'T',
          detail.cpt_cdt_code || '',
          detail.free_text || '',
          detail.place_of_service || '',
          detail.referring_doctor_2 || '',
          detail.tracking_number || '',
          detail.reading_additions || '',
          detail.lens_prescription || '',
          detail.density_of_tint || '',
          detail.patient_id_number || '',
          detail.service_time || '',
          detail.employer_name || '',
          detail.employee_number || '',
          detail.date_of_injury || '',
          detail.iod_reference_number || ''
        ];
        
        datContent += fields.join(',') + '\n';
      });
      
      // Trailer line (Z record)
      const totalDetailTx = trailer?.total_detail_transactions || batchDetails.length;
      const totalAmountTrailer = (trailer?.total_amount_detail_transactions || batch.total_amount) * 100;
      datContent += `Z,${totalDetailTx},${totalDetailTx},${totalAmountTrailer.toFixed(0)},,,,,,,,,,,,,,,,,,,,,,\n`;

      // Generate filename with new naming convention: practicenumber_sequence_provider
      const newFileName = `${batch.practice_number || 'UNKNOWN'}_${sequenceNumber}_${batch.medical_aid_reference || 'UNKNOWN'}`;

      // Download the file with .dat extension
      const blob = new Blob([datContent], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Ensure .dat extension
      let downloadFileName = newFileName;
      if (!downloadFileName.toLowerCase().endsWith('.dat')) {
        downloadFileName = downloadFileName + '.dat';
      }
      
      a.download = downloadFileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      toast.success(`✅ Downloaded ${newFileName}.dat (${batchDetails.length} claims)`);

    } catch (error: any) {
      console.error('❌ Error in manual .dat generation:', error);
      toast.error('Failed to generate .dat file');
    }
  };

  // Function to fetch and display batch details
  const handleViewBatchDetails = async (batch: BatchData) => {
    try {
      setLoadingBatchDetails(true);
      setSelectedBatchForDetails(batch);
      
      const { data: batchDetails, error: batchError } = await supabase
        .from('batch_details')
        .select('*')
        .eq('batch_header_id', batch.batch_id)
        .order('transaction_number_in_batch', { ascending: true });

      if (batchError) throw batchError;
      
      setBatchDetailsData(batchDetails || []);
      
    } catch (error: any) {
      console.error('Error fetching batch details:', error);
      toast.error('Failed to load batch details');
    } finally {
      setLoadingBatchDetails(false);
    }
  };

  // Batch data is only needed on the batch-management tab
  useEffect(() => {
    if (activeTab === 'batch-management') {
      console.log('📊 Batch management tab active - triggering fetch');
      fetchBatchData();
    }
  }, [activeTab]); // fetchBatchData intentionally omitted from dependencies

  // Refetch data when filter changes (only for batch-management tab)
  useEffect(() => {
    if (activeTab === 'batch-management' && batchFilters) {
      console.log('🔄 Filter changed, refetching batch data');
      fetchBatchData();
    }
  }, [batchFilters.paid, batchFilters.unpaid, batchFilters.active]); // Use specific filter values

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  const renderBatchManagement = () => {
    if (batchLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading batch data...</p>
          </div>
        </div>
      );
    }

    // Filter batches based on multiple selected filters
    const filteredBatches = batches.filter(batch => {
      // If no filters are active, show nothing
      if (!batchFilters.paid && !batchFilters.unpaid && !batchFilters.active) return false;
      
      // Show if any of the active filters match
      return (batchFilters.paid && batch.status === 'paid') ||
             (batchFilters.unpaid && batch.status === 'unpaid') ||
             (batchFilters.active && batch.status === 'active');
    });

    if (filteredBatches.length === 0) {
      return (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            {/* Header with controls */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Icon icon="solar:box-bold-duotone" className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Batches ({filteredBatches.length})
                </h3>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Filter Toggles */}
                <div className="flex items-center gap-4">
                  {/* Paid Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Paid</span>
                    <button
                      onClick={() => setBatchFilters(prev => ({ ...prev, paid: !prev.paid }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        batchFilters.paid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          batchFilters.paid ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Unpaid Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Unpaid</span>
                    <button
                      onClick={() => setBatchFilters(prev => ({ ...prev, unpaid: !prev.unpaid }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        batchFilters.unpaid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          batchFilters.unpaid ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <button
                      onClick={() => setBatchFilters(prev => ({ ...prev, active: !prev.active }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        batchFilters.active ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          batchFilters.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                
                {/* Submit All Button */}
                <button 
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                  onClick={handleSubmitAll}
                  disabled={isSubmittingAll || batches.filter(b => b.status === 'active').length === 0}
                >
                  {isSubmittingAll ? (
                    <>
                      <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:send-square-bold-duotone" className="w-4 h-4" />
                      Submit All Active
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-center py-12">
              <Icon icon="solar:box-minimalistic-bold-duotone" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No batches found for selected filters</p>
              <p className="text-sm text-gray-400">Batches will appear here when they are created</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          {/* Header with controls */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Icon icon="solar:box-bold-duotone" className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">
                Batches ({filteredBatches.length})
              </h3>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Filter Toggles */}
              <div className="flex items-center gap-4">
                {/* Paid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Paid</span>
                  <button
                    onClick={() => setBatchFilters(prev => ({ ...prev, paid: !prev.paid }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      batchFilters.paid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        batchFilters.paid ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Unpaid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Unpaid</span>
                  <button
                    onClick={() => setBatchFilters(prev => ({ ...prev, unpaid: !prev.unpaid }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      batchFilters.unpaid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        batchFilters.unpaid ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Active</span>
                  <button
                    onClick={() => setBatchFilters(prev => ({ ...prev, active: !prev.active }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      batchFilters.active ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        batchFilters.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              {/* Submit All Button */}
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                onClick={handleSubmitAll}
                disabled={isSubmittingAll || batches.filter(b => b.status === 'active').length === 0}
              >
                {isSubmittingAll ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:send-square-bold-duotone" className="w-4 h-4" />
                    Submit All Active
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Professional table-style batch cards */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-600">Batch #</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Medical Aid</th>
                    <th className="py-4 px-4"></th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Created Date</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-600">Invoices & Services</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Total Amount</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch, index) => {
                    const themeColor = batch.medical_aid_theme_color || MEDICAL_AID_THEMES[batch.medical_aid_reference] || '#6B7280';
                    const lightColor = lightenColor(themeColor, 0.85);
                    const isSubmitting = submittingBatches.has(batch.batch_id);
                    
                    return (
                      <motion.tr
                        key={batch.batch_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors group"
                      >
                        {/* Batch Number Badge with Heartbeat Animation */}
                        <td className="py-4 px-6 text-center">
                          <div className="relative inline-flex items-center justify-center">
                            {/* Heartbeat ring for active batches only */}
                            {batch.status === 'active' && (
                              <div 
                                className="absolute inset-0 rounded-full heartbeat-ring"
                                style={{ 
                                  background: `linear-gradient(45deg, ${themeColor}40, ${lightenColor(themeColor, 0.3)}60)`,
                                  transform: 'scale(1.4)'
                                }}
                              />
                            )}
                            <div 
                              className="relative inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-xs shadow-sm z-10"
                              style={{ backgroundColor: themeColor }}
                            >
                              {batch.batch_number}
                            </div>
                          </div>
                        </td>

                        {/* Medical Aid Info */}
                        <td className="py-4 px-6">
                          <div>
                            <div className="text-sm text-gray-600 font-medium">
                              {batch.medical_aid_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {batch.medical_aid_reference}
                            </div>
                          </div>
                        </td>

                        {/* Medical Aid Logo Column */}
                        <td className="py-4 px-4 text-center">
                          {batch.medical_aid_logo_url ? (
                            <img 
                              src={batch.medical_aid_logo_url} 
                              alt={batch.medical_aid_name}
                              className="w-12 h-12 rounded-lg object-contain bg-white p-1 shadow-sm mx-auto"
                            />
                          ) : (
                            <div 
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm mx-auto"
                              style={{ backgroundColor: themeColor }}
                            >
                              {batch.medical_aid_short_name.substring(0, 2)}
                            </div>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-700 font-medium">
                            {format(new Date(batch.batch_date), 'MMM dd, yyyy')}
                          </div>
                        </td>

                        {/* Invoices & Services */}
                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center items-center gap-6">
                            <div className="flex flex-col items-center">
                              <div 
                                className="text-xl font-bold"
                                style={{ color: themeColor }}
                              >
                                {batch.total_invoices}
                              </div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide">
                                Invoices
                              </div>
                            </div>
                            <div className="w-px h-8 bg-gray-300"></div>
                            <div className="flex flex-col items-center">
                              <div 
                                className="text-xl font-bold"
                                style={{ color: lightenColor(themeColor, 0.3) }}
                              >
                                {batch.detail_transactions}
                              </div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide">
                                Services
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex flex-col items-end">
                            <div className="text-2xl font-bold text-gray-800">
                              {(() => {
                                const amount = parseFloat(batch.total_amount);
                                const formatted = amount.toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                });
                                const [wholePart, centsPart] = formatted.split('.');
                                return (
                                  <>
                                    N${wholePart}
                                    {centsPart && <span className="text-gray-400">.{centsPart}</span>}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              Total
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6">
                          <div className="flex justify-end gap-2">
                            {/* View Details button */}
                            <button
                              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                              onClick={() => handleViewBatchDetails(batch)}
                              title="View batch details"
                            >
                              <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
                              Details
                            </button>
                            
                            {/* Download .dat button */}
                            {batch.status === 'active' && (
                              <button
                                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                                onClick={() => handleDownloadDat(batch)}
                                title="Download .dat file"
                              >
                                <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
                                .dat
                              </button>
                            )}
                            
                            {/* Submit button */}
                            <button
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleIndividualSubmit(batch.batch_id)}
                              disabled={isSubmitting || isSubmittingAll || batch.status !== 'active'}
                            >
                              {isSubmitting ? (
                                <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Icon icon="solar:send-square-bold-duotone" className="w-4 h-4" />
                                  Submit
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Batch Details Modal
  const renderBatchDetailsModal = () => {
    if (!selectedBatchForDetails || !batchDetailsData.length) return null;

    return (
      <Dialog 
        open={!!selectedBatchForDetails} 
        onOpenChange={() => {
          setSelectedBatchForDetails(null);
          setBatchDetailsData([]);
        }}
      >
        <DialogContent className="w-[95vw] max-w-[1600px] max-h-[90vh] overflow-hidden bg-gradient-to-br from-white to-gray-50 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 -m-6 mb-4 p-6 rounded-t-lg">
            <DialogTitle className="text-2xl font-bold flex items-center justify-between text-gray-800">
              <div className="flex items-center gap-3">
                <Icon icon="solar:document-text-bold-duotone" className="w-8 h-8 text-cyan-600" />
                Batch Details - {selectedBatchForDetails.batch_number}
                <span className="text-base font-normal text-gray-600 flex items-center gap-2">
                  <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-cyan-500" />
                  {selectedBatchForDetails.medical_aid_name} • {batchDetailsData.length} transactions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Download batch as CSV
                    const headers = ['Col', 'Type', 'Tx#', 'Sys Tx#', 'Pat Ref', 'Service', 'MA Ref', 'Member #', 'Surname', 'Initials', 
                      'Patient', 'DOB', 'BHF Code', 'Amount', 'Diagnosis', 'Discount', 'Date', '# Svcs', 'Fee', 'Mod1', 'Mod2', 'Mod3', 
                      'Mod4', 'Invoice', 'Ref Dr', 'NAPPI', 'Ref Prac', 'Practice', 'Hosp', 'Auth', 'Resub', 'ICD', 'ICD Type', 'Dosage', 
                      'HPCSA', 'Tooth', 'Gender', 'Tariff Type', 'CPT/CDT', 'Free Text', 'Place', 'Ref Dr2', 'Track#', 'Reading', 'Lens', 
                      'Tint', 'ID#', 'Time', 'Employer', 'Emp#', 'Injury', 'IOD Ref'];
                    const csvContent = [
                      headers.join(','),
                      ...batchDetailsData.map((detail, index) => [
                        index + 1,
                        detail.transaction_id || 'D',
                        detail.transaction_number_in_batch,
                        detail.system_transaction_number || '',
                        detail.system_patient_reference_number?.padStart(7, '0') || '0000000',
                        detail.type_of_service || 'T',
                        detail.medical_aid_reference,
                        detail.medical_aid_membership_number,
                        detail.member_surname,
                        detail.member_initials,
                        detail.patient_name,
                        detail.patient_date_of_birth,
                        detail.bhf_tariff_code,
                        detail.service_amount,
                        detail.diagnosis || '',
                        detail.discount_amount || '',
                        detail.service_date,
                        detail.number_of_services || 1,
                        detail.service_fee || '',
                        detail.modifier_1 || '',
                        detail.modifier_2 || '',
                        detail.modifier_3 || '',
                        detail.modifier_4 || '',
                        detail.invoice_number,
                        detail.referring_doctor || '',
                        detail.nappi_code || '',
                        detail.referred_to_practice_number || '',
                        detail.practice_number,
                        detail.hospital_indicator || '',
                        detail.authorisation_number || '',
                        detail.resubmission_flag || '',
                        detail.diagnostic_code || '',
                        detail.diagnostic_code_type || '',
                        detail.dosage_description || '',
                        detail.treating_doctor_hpcsa_number || '',
                        detail.tooth_numbers || '',
                        detail.gender || '',
                        detail.tariff_code_type || 'T',
                        detail.cpt_cdt_code || '',
                        detail.free_text || '',
                        detail.place_of_service || '',
                        detail.referring_doctor_2 || '',
                        detail.tracking_number || '',
                        detail.reading_additions || '',
                        detail.lens_prescription || '',
                        detail.density_of_tint || '',
                        detail.patient_id_number || '',
                        detail.service_time || '',
                        detail.employer_name || '',
                        detail.employee_number || '',
                        detail.date_of_injury ? format(new Date(detail.date_of_injury), 'yyyyMMdd') : '',
                        detail.iod_reference_number || ''
                      ].join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `batch_${selectedBatchForDetails.batch_number}_details.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
                  Download CSV
                </button>
                <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-lg">
                  54 Columns
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-auto max-h-[calc(90vh-120px)] p-6">
            <div className="space-y-4">
              {/* Header Information */}
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-6 mb-6 shadow-sm border border-cyan-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Icon icon="solar:buildings-2-bold-duotone" className="w-5 h-5 text-cyan-600" />
                      <span className="text-sm">Practice:</span>
                    </div>
                    <span className="font-semibold text-gray-800">{selectedBatchForDetails.practice_number}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-cyan-600" />
                      <span className="text-sm">Batch Date:</span>
                    </div>
                    <span className="font-semibold text-gray-800">{format(new Date(selectedBatchForDetails.batch_date), 'yyyy-MM-dd')}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Icon icon="solar:money-bag-bold-duotone" className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Total Amount:</span>
                    </div>
                    <span className="font-bold text-lg text-green-700">R{selectedBatchForDetails.total_amount.toFixed(2)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-cyan-600" />
                      <span className="text-sm">Status:</span>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedBatchForDetails.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedBatchForDetails.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Records Table */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      <tr>
                        {/* Column 1-10: Core Transaction Info */}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10">Row</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">1</span>
                            <span>Type</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">2</span>
                            <span>Tx#</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">3</span>
                            <span>Sys Tx#</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">4</span>
                            <span>Pat Ref</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">5</span>
                            <span>Service</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">6</span>
                            <span>MA Ref</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">7</span>
                            <span>-</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">8</span>
                            <span>Member #</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">9</span>
                            <span>Surname</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">10</span>
                            <span>Initials</span>
                          </div>
                        </th>
                        {/* Column 11-20: Patient & Service Info */}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">11</span>
                            <span>Patient</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">12</span>
                            <span>DOB</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">13</span>
                            <span>BHF Code</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">14</span>
                            <span>Amount</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">15</span>
                            <span>Diagnosis</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">16</span>
                            <span>Discount</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">17</span>
                            <span>Date</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">18</span>
                            <span># Svcs</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">19</span>
                            <span>Fee</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">20</span>
                            <span>Mod1</span>
                          </div>
                        </th>
                        {/* Column 21-30: Modifiers & Practice Info */}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">21</span>
                            <span>Mod2</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">22</span>
                            <span>Mod3</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">23</span>
                            <span>Mod4</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">24</span>
                            <span>Invoice</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">25</span>
                            <span>Ref Dr</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">26</span>
                            <span>NAPPI</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">27</span>
                            <span>Ref Prac</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">28</span>
                            <span>-</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">29</span>
                            <span>Practice</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">30</span>
                            <span>Hosp</span>
                          </div>
                        </th>
                        {/* Column 31-40: Diagnostic & Additional Info */}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">31</span>
                            <span>Auth</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">32</span>
                            <span>Resub</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">33</span>
                            <span>ICD</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">34</span>
                            <span>ICD Type</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">35</span>
                            <span>Dosage</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">36</span>
                            <span>-</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">37</span>
                            <span>HPCSA</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">38</span>
                            <span>Tooth</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">39</span>
                            <span>Gender</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">40</span>
                            <span>Tariff Type</span>
                          </div>
                        </th>
                        {/* Column 41-50: Extended Info */}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">41</span>
                            <span>CPT/CDT</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">42</span>
                            <span>Free Text</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">43</span>
                            <span>Place</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">44</span>
                            <span>Ref Dr2</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">45</span>
                            <span>Track#</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">46</span>
                            <span>Reading</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">47</span>
                            <span>Lens</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">48</span>
                            <span>Tint</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">49</span>
                            <span>ID#</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">50</span>
                            <span>Time</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">51</span>
                            <span>Employer</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">52</span>
                            <span>Emp#</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">53</span>
                            <span>Injury</span>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-600 font-bold">54</span>
                            <span>IOD Ref</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {batchDetailsData.map((detail, index) => (
                        <tr key={detail.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-cyan-50/30 transition-colors`}>
                          {/* Column Number Indicator */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-500 sticky left-0 bg-white z-10">
                            {index + 1}
                          </td>
                          {/* Col 1: Type (D) */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700 font-mono">{detail.transaction_id || 'D'}</td>
                          {/* Col 2: Transaction Number in Batch */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-cyan-700">{detail.transaction_number_in_batch}</td>
                          {/* Col 3: System Transaction Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.system_transaction_number || '-'}</td>
                          {/* Col 4: Patient Reference (7 digits) */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700">{detail.system_patient_reference_number?.padStart(7, '0') || '0000000'}</td>
                          {/* Col 5: Type of Service */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              detail.type_of_service === 'T' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {detail.type_of_service || 'T'}
                            </span>
                          </td>
                          {/* Col 6: Medical Aid Reference */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-700">{detail.medical_aid_reference}</td>
                          {/* Col 7: Not Used 1 (Empty) */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-400">-</td>
                          {/* Col 8: Member Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700">{detail.medical_aid_membership_number}</td>
                          {/* Col 9: Surname */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.member_surname}</td>
                          {/* Col 10: Initials */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.member_initials}</td>
                          {/* Col 11: Patient Name */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-800">{detail.patient_name}</td>
                          {/* Col 12: DOB */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.patient_date_of_birth}</td>
                          {/* Col 13: BHF Tariff Code */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-cyan-700">{detail.bhf_tariff_code}</td>
                          {/* Col 14: Service Amount */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-bold text-green-700">
                            R{Number(detail.service_amount).toFixed(2)}
                          </td>
                          {/* Col 15: Diagnosis */}
                          <td className="px-3 py-2 text-xs text-gray-700">
                            <div className="max-w-[200px] truncate" title={detail.diagnosis}>
                              {detail.diagnosis || '-'}
                            </div>
                          </td>
                          {/* Col 16: Discount Amount */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-700">
                            {detail.discount_amount ? `R${Number(detail.discount_amount).toFixed(2)}` : '-'}
                          </td>
                          {/* Col 17: Service Date */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.service_date}</td>
                          {/* Col 18: Number of Services */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-center font-semibold">{detail.number_of_services || 1}</td>
                          {/* Col 19: Service Fee */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.service_fee || '-'}</td>
                          {/* Col 20-23: Modifiers */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.modifier_1 || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.modifier_2 || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.modifier_3 || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.modifier_4 || '-'}</td>
                          {/* Col 24: Invoice Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-cyan-700">{detail.invoice_number}</td>
                          {/* Col 25: Referring Doctor */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.referring_doctor || '-'}</td>
                          {/* Col 26: NAPPI Code */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.nappi_code || '-'}</td>
                          {/* Col 27: Referred to Practice */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.referred_to_practice_number || '-'}</td>
                          {/* Col 28: Not Used 2 (Empty) */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-400">-</td>
                          {/* Col 29: Practice Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700">{detail.practice_number}</td>
                          {/* Col 30: Hospital Indicator */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.hospital_indicator || '-'}</td>
                          {/* Col 31: Authorization Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {detail.authorisation_number ? (
                              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">
                                {detail.authorisation_number}
                              </span>
                            ) : '-'}
                          </td>
                          {/* Col 32: Resubmission Flag */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.resubmission_flag || '-'}</td>
                          {/* Col 33: Diagnostic Code */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700">{detail.diagnostic_code || '-'}</td>
                          {/* Col 34: Diagnostic Code Type */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.diagnostic_code_type || '-'}</td>
                          {/* Col 35: Dosage Description */}
                          <td className="px-3 py-2 text-xs text-gray-700">
                            <div className="max-w-[150px] truncate" title={detail.dosage_description}>
                              {detail.dosage_description || '-'}
                            </div>
                          </td>
                          {/* Col 36: Not Used 3 (Empty) */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-400">-</td>
                          {/* Col 37: Treating Doctor HPCSA */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-cyan-700">{detail.treating_doctor_hpcsa_number || '-'}</td>
                          {/* Col 38: Tooth Numbers */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.tooth_numbers || '-'}</td>
                          {/* Col 39: Gender */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                              detail.gender === 'M' ? 'bg-blue-100 text-blue-700' : 
                              detail.gender === 'F' ? 'bg-pink-100 text-pink-700' : 
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {detail.gender || '-'}
                            </span>
                          </td>
                          {/* Col 40: Tariff Code Type */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.tariff_code_type || 'T'}</td>
                          {/* Col 41: CPT/CDT Code */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-cyan-700">{detail.cpt_cdt_code || '-'}</td>
                          {/* Col 42: Free Text */}
                          <td className="px-3 py-2 text-xs text-gray-700">
                            <div className="max-w-[200px] truncate" title={detail.free_text}>
                              {detail.free_text || '-'}
                            </div>
                          </td>
                          {/* Col 43: Place of Service */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.place_of_service || '-'}</td>
                          {/* Col 44: Referring Doctor 2 */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.referring_doctor_2 || '-'}</td>
                          {/* Col 45: Tracking Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700">{detail.tracking_number || '-'}</td>
                          {/* Col 46: Reading Additions */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.reading_additions || '-'}</td>
                          {/* Col 47: Lens Prescription */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.lens_prescription || '-'}</td>
                          {/* Col 48: Density of Tint */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.density_of_tint || '-'}</td>
                          {/* Col 49: Patient ID Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700">{detail.patient_id_number || '-'}</td>
                          {/* Col 50: Service Time */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.service_time || '-'}</td>
                          {/* Col 51: Employer Name */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.employer_name || '-'}</td>
                          {/* Col 52: Employee Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.employee_number || '-'}</td>
                          {/* Col 53: Date of Injury */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                            {detail.date_of_injury ? format(new Date(detail.date_of_injury), 'yyyyMMdd') : '-'}
                          </td>
                          {/* Col 54: IOD Reference Number */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{detail.iod_reference_number || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gradient-to-r from-cyan-100 to-blue-100 border-t-2 border-cyan-200">
                      <tr>
                        <td colSpan={13} className="px-4 py-4 text-right font-semibold text-gray-800 text-lg">
                          Total Amount:
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-xl text-cyan-700">
                          <div className="flex items-center justify-end gap-2">
                            <Icon icon="solar:safe-square-bold-duotone" className="w-6 h-6 text-cyan-600" />
                            R{batchDetailsData.reduce((sum, detail) => sum + Number(detail.service_amount), 0).toFixed(2)}
                          </div>
                        </td>
                        <td colSpan={40}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Additional Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Modifiers & Codes</h4>
                  <div className="space-y-1 text-sm">
                    {batchDetailsData.slice(0, 5).map((detail, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-500">Tx {detail.transaction_number_in_batch}:</span>
                        <span className="text-gray-700">
                          {[detail.modifier_1, detail.modifier_2, detail.modifier_3, detail.modifier_4]
                            .filter(Boolean)
                            .join(', ') || 'None'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Practice & Doctor Info</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Practice Number:</span>
                      <span className="text-gray-700">{batchDetailsData[0]?.practice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Referring Doctors:</span>
                      <span className="text-gray-700">
                        {[...new Set(batchDetailsData.map(d => d.referring_doctor).filter(Boolean))].join(', ') || 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">HPCSA Numbers:</span>
                      <span className="text-gray-700">
                        {[...new Set(batchDetailsData.map(d => d.treating_doctor_hpcsa_number).filter(Boolean))].join(', ') || 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        <FinanceHeader
          period={financePage.period}
          ranges={financePage.labels.ranges}
          onPeriodChange={financePage.setPeriod}
          showPeriod={activeTab !== 'batch-management'}
          loadedAt={financePage.workspace?.loadedAt ?? null}
          refreshing={financePage.loading}
          onRefresh={financePage.refresh}
        />

        <FinanceTabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === 'batch-management' ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6">
              <motion.div
                key="batch-management"
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <ClaimsBatches practiceId={financePracticeId || ''} />
              </motion.div>
            </div>
          </div>
        ) : (
          <FinanceTabContent tab={activeTab} page={financePage} practiceName={practiceName} onTabChange={setActiveTab} />
        )}
      </div>
      
      {/* Render Batch Details Modal */}
      {renderBatchDetailsModal()}
    </div>
  );
};

export default Finance;