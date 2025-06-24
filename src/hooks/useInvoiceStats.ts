import { useState, useEffect } from 'react';
import { InvoiceStats, invoiceStatsService } from '../services/invoiceStatsService';

export const useInvoiceStats = () => {
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats>({
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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoiceStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const stats = await invoiceStatsService.getInvoiceStats();
      setInvoiceStats(stats);
    } catch (err) {
      console.error('❌ useInvoiceStats Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceStats();
  }, []);

  return {
    invoiceStats,
    isLoading,
    error,
    refreshStats: fetchInvoiceStats
  };
};