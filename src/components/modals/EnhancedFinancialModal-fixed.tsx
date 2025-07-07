// Fixed fetchBatchData function for EnhancedFinancialModal.tsx
// This version properly handles the practice ID to practice number mapping

// Replace the existing fetchBatchData function (lines 472-602) with this:

  // Fetch batch management data
  const fetchBatchData = useCallback(async () => {
    console.log('🔍 fetchBatchData called');
    console.log('📍 selectedPracticeId:', selectedPracticeId);
    console.log('👤 user:', user);
    console.log('🏥 user.practice_id:', user?.practice_id);
    
    // Use selectedPracticeId or fallback to user's practice_id
    const practiceId = selectedPracticeId || user?.practice_id;
    
    if (!practiceId) {
      console.warn('❌ No practice ID found (neither selectedPracticeId nor user.practice_id)');
      console.log('🔧 Available user fields:', user ? Object.keys(user) : 'No user');
      return;
    }
    
    console.log('✅ Using practice ID:', practiceId);
    
    setBatchLoading(true);
    try {
      // Method 1: Try using the RPC function if it exists
      console.log('🔍 Attempting to use get_practice_batches function...');
      try {
        const { data: batchData, error: rpcError } = await supabase
          .rpc('get_practice_batches', { 
            p_practice_id: practiceId 
          });
        
        if (!rpcError && batchData) {
          console.log('✅ Successfully fetched batches using RPC function');
          console.log('📊 Found batches count:', batchData.length);
          
          // Apply filters on the client side
          const filteredBatches = batchData.filter(batch => {
            if (!batchFilters.paid && !batchFilters.unpaid && !batchFilters.active) return false;
            
            return (batchFilters.paid && batch.status === 'paid') ||
                   (batchFilters.unpaid && batch.status === 'unpaid') ||
                   (batchFilters.active && batch.status === 'active');
          });
          
          setBatches(filteredBatches);
          return;
        }
      } catch (rpcErr) {
        console.log('⚠️ RPC function not available, falling back to direct query');
      }
      
      // Method 2: Fallback to direct query with practice number lookup
      console.log('🏥 Fetching practice data for ID:', practiceId);
      
      // First get the practice details to find practice_number
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('id, name, practice_number')
        .eq('id', practiceId)
        .single();

      if (practiceError) {
        console.error('❌ Practice query error:', practiceError);
        
        // If practice not found, try direct batch_headers query by practice_id
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
        
        if (!directError && directBatches) {
          console.log('✅ Found batches using direct query:', directBatches.length);
          
          // Transform to match the view structure
          const transformedBatches = directBatches.map(batch => ({
            batch_id: batch.id,
            practice_number: batch.practice_number,
            batch_number: batch.batch_number,
            batch_date: batch.batch_date,
            medical_aid_reference: batch.medical_aid_reference,
            status: batch.status,
            total_invoices: batch.total_invoices,
            total_amount: batch.total_amount,
            created_at: batch.created_at,
            sent_at: batch.sent_at,
            confirmed_at: batch.confirmed_at,
            medical_aid_name: batch.medical_aid_providers?.name,
            medical_aid_short_name: batch.medical_aid_providers?.short_name,
            medical_aid_email: batch.medical_aid_providers?.email,
            medical_aid_logo_url: batch.medical_aid_providers?.logo_url,
            medical_aid_theme_color: batch.medical_aid_providers?.theme_color,
            practice_name: batch.practices?.name,
            practice_email: batch.practices?.contact_email,
            detail_transactions: 0, // Would need separate query
            total_detail_transactions: 0,
            total_amount_detail_transactions: 0,
            dat_filename: `${batch.practice_number}_${batch.batch_number}_${batch.medical_aid_reference}`
          }));
          
          setBatches(transformedBatches);
          return;
        }
        
        setBatches([]);
        return;
      }
      
      console.log('🏥 Practice found:', practiceData);
      
      // Now query using practice_number if available
      if (practiceData.practice_number) {
        console.log('🔍 Querying batches with practice_number:', practiceData.practice_number);
        
        const { data: batchData, error: batchError } = await supabase
          .from('batch_management_view')
          .select('*')
          .eq('practice_number', practiceData.practice_number)
          .order('created_at', { ascending: false });
        
        if (!batchError && batchData) {
          console.log('✅ Found batches:', batchData.length);
          setBatches(batchData);
          return;
        }
        
        if (batchError) {
          console.error('❌ Batch query error:', batchError);
        }
      }
      
      // Final fallback: check if there are any batches in the system
      console.log('🔍 Checking for any batches in the system...');
      const { data: anyBatches, count } = await supabase
        .from('batch_management_view')
        .select('*', { count: 'exact', head: false })
        .limit(5);
      
      console.log('📊 Total batches in system:', count);
      console.log('📋 Sample batches:', anyBatches);
      
      setBatches([]);
      
    } catch (error) {
      console.error('❌ Error fetching batch data:', error);
      setBatches([]);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedPracticeId, user, batchFilters]);