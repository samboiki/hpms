import { supabase } from '../lib/supabase';
import { practiceDataService } from '../lib/practiceDataService';

export interface InvoiceStats {
  totalInvoices: number;
  totalRevenue: number;
  quarterlyRevenue: number;
  quarterlyInvoices: number;
  quarterlyPaidInvoices: number;
  quarterlyOutstandingInvoices: number;
  paidInvoices: number;
  outstandingInvoices: number;
  percentagePaid: number;
  percentageOutstanding: number;
  quarterlyPercentagePaid: number;
  quarterlyPercentageOutstanding: number;
  currentQuarter: number;
  practiceId: string;
}

export const invoiceStatsService = {
  /**
   * Get comprehensive invoice statistics for the logged-in user's practice
   */
  async getInvoiceStats(): Promise<InvoiceStats> {
    try {
      // Get authenticated user context
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext) {
        throw new Error('Authentication failed');
      }

      const practiceId = authContext.practiceId;

      // Get total invoice count and revenue for the practice
      const { data: totalStats, error: totalError } = await supabase
        .from('invoices_enhanced')
        .select('total, payment_status')
        .eq('practice_id', practiceId);

      if (totalError) {
        throw new Error(`Failed to fetch total invoice stats: ${totalError.message}`);
      }

      // Get quarterly data (current quarter)
      // Jan-Mar = Q1, Apr-Jun = Q2, Jul-Sep = Q3, Oct-Dec = Q4
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth(); // 0-11
      const currentQuarter = Math.floor(currentMonth / 3) + 1;
      const quarterStart = new Date(currentDate.getFullYear(), (currentQuarter - 1) * 3, 1);
      const quarterEnd = new Date(currentDate.getFullYear(), currentQuarter * 3, 0); // Last day of quarter
      
      const { data: quarterlyStats, error: quarterlyError } = await supabase
        .from('invoices_enhanced')
        .select('total, payment_status')
        .eq('practice_id', practiceId)
        .gte('issue_date', quarterStart.toISOString().split('T')[0])
        .lte('issue_date', quarterEnd.toISOString().split('T')[0]);

      if (quarterlyError) {
        throw new Error(`Failed to fetch quarterly invoice stats: ${quarterlyError.message}`);
      }

      // Calculate total statistics
      const totalInvoices = totalStats?.length || 0;
      const paidInvoices = totalStats?.filter(invoice => invoice.payment_status === 'paid').length || 0;
      // Outstanding includes pending, overdue, and any other non-paid statuses
      const outstandingInvoices = totalStats?.filter(invoice => invoice.payment_status !== 'paid').length || 0;
      const totalRevenue = totalStats?.reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0) || 0;
      
      // Calculate quarterly statistics
      const quarterlyInvoices = quarterlyStats?.length || 0;
      const quarterlyPaidInvoices = quarterlyStats?.filter(invoice => invoice.payment_status === 'paid').length || 0;
      // Outstanding includes pending, overdue, and any other non-paid statuses
      const quarterlyOutstandingInvoices = quarterlyStats?.filter(invoice => invoice.payment_status !== 'paid').length || 0;
      // Total quarterly revenue includes both paid and unpaid invoices
      const quarterlyRevenue = quarterlyStats?.reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0) || 0;

      // Calculate percentages for total (should always add up to 100%)
      const percentagePaid = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;
      const percentageOutstanding = totalInvoices > 0 ? Math.round((outstandingInvoices / totalInvoices) * 100) : 0;
      
      // Calculate percentages for quarterly (should always add up to 100%)
      const quarterlyPercentagePaid = quarterlyInvoices > 0 ? Math.round((quarterlyPaidInvoices / quarterlyInvoices) * 100) : 0;
      const quarterlyPercentageOutstanding = quarterlyInvoices > 0 ? Math.round((quarterlyOutstandingInvoices / quarterlyInvoices) * 100) : 0;

      console.log('📊 Invoice Stats Service Results:', {
        practiceId,
        currentQuarter,
        quarterPeriod: `Q${currentQuarter} ${currentDate.getFullYear()} (${quarterStart.toISOString().split('T')[0]} to ${quarterEnd.toISOString().split('T')[0]})`,
        totalInvoices,
        quarterlyInvoices,
        paidInvoices,
        outstandingInvoices,
        quarterlyPaidInvoices,
        quarterlyOutstandingInvoices,
        totalRevenue,
        quarterlyRevenue,
        percentagePaid,
        percentageOutstanding,
        quarterlyPercentagePaid,
        quarterlyPercentageOutstanding
      });

      return {
        totalInvoices,
        totalRevenue,
        quarterlyRevenue,
        quarterlyInvoices,
        quarterlyPaidInvoices,
        quarterlyOutstandingInvoices,
        paidInvoices,
        outstandingInvoices,
        percentagePaid,
        percentageOutstanding,
        quarterlyPercentagePaid,
        quarterlyPercentageOutstanding,
        currentQuarter,
        practiceId
      };

    } catch (error) {
      console.error('❌ InvoiceStatsService Error:', error);
      
      // Return fallback data
      return {
        totalInvoices: 0,
        totalRevenue: 0,
        quarterlyRevenue: 0,
        quarterlyInvoices: 0,
        quarterlyPaidInvoices: 0,
        quarterlyOutstandingInvoices: 0,
        paidInvoices: 0,
        outstandingInvoices: 0,
        percentagePaid: 0,
        percentageOutstanding: 0,
        quarterlyPercentagePaid: 0,
        quarterlyPercentageOutstanding: 0,
        currentQuarter: 0,
        practiceId: ''
      };
    }
  }
};