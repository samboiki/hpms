import { createClient } from '@supabase/supabase-js';
import { PayrollService } from '../services/payrollService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function regeneratePayslip() {
  try {
    console.log('Regenerating payslip for Andreas David...');
    
    // Andreas David's user ID
    const userId = '00dd5a75-fd97-448b-8e66-e192400f49f2';
    const payPeriod = new Date('2025-06-01'); // June 2025
    
    // Generate the payslip
    const result = await PayrollService.generatePayslips([userId], payPeriod);
    
    console.log('Generation result:', result);
    
    if (result.results[0]?.success) {
      console.log('Payslip generated successfully!');
      console.log('Payslip ID:', result.results[0].payslipId);
    } else {
      console.error('Failed to generate payslip:', result.errors);
    }
    
  } catch (error) {
    console.error('Error regenerating payslip:', error);
  }
}

// Run the function
regeneratePayslip();