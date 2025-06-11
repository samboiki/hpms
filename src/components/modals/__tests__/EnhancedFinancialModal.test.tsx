import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EnhancedFinancialModal from '../EnhancedFinancialModal';
import { supabase } from '../../../lib/supabase';

// Mock Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        }))
      }))
    }))
  }
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => children
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />
}));

const mockFinancialData = {
  type: 'finance' as const,
  title: 'Financial Overview',
  subtitle: 'Revenue and Performance Analytics',
  overview: {
    total: 125000,
    change: '+12.5%',
    isPositive: true,
    period: '30 days'
  },
  breakdown: [
    { label: 'Medical Aid', value: 75000, percentage: 60, color: '#8b5cf6' },
    { label: 'Self Pay', value: 50000, percentage: 40, color: '#06b6d4' }
  ],
  chartData: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Revenue',
      data: [10000, 12000, 11000, 15000, 13000, 16000],
      backgroundColor: '#8b5cf6',
      borderColor: '#7c3aed'
    }]
  },
  insights: [
    'Revenue increased by 12.5% compared to last month',
    'Medical Aid payments represent 60% of total revenue',
    'Peak revenue period was in June'
  ]
};

describe('EnhancedFinancialModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal when open', () => {
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    expect(screen.getByText('Financial Analytics')).toBeInTheDocument();
    expect(screen.getByText('Revenue and Performance Analytics')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <EnhancedFinancialModal
        isOpen={false}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    expect(screen.queryByText('Financial Analytics')).not.toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    expect(screen.getByText('Loading financial analytics...')).toBeInTheDocument();
  });

  it('renders all date range options', () => {
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    expect(screen.getByText('7D')).toBeInTheDocument();
    expect(screen.getByText('30D')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
  });

  it('switches between date ranges', async () => {
    const mockSupabaseResponse = {
      data: [{
        total_revenue: 125000,
        monthly_revenue: 18500,
        outstanding_amount: 5200,
        paid_invoices: 45,
        pending_invoices: 12,
        medical_aid_revenue: 75000,
        self_pay_revenue: 50000,
        revenue_growth_percent: 12.5,
        avg_invoice_value: 2500
      }],
      error: null
    };

    (supabase.from as any).mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve(mockSupabaseResponse)
      })
    });

    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    const sevenDayButton = screen.getByText('7D');
    fireEvent.click(sevenDayButton);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('financial_dashboard_fast');
    });
  });

  it('renders all tabs correctly', () => {
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
    expect(screen.getByText('Batch Management')).toBeInTheDocument();
  });

  it('switches between tabs', () => {
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    const financialTab = screen.getByText('Financial Overview');
    fireEvent.click(financialTab);

    // Should switch to financial tab content
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={mockOnClose}
        data={mockFinancialData}
      />
    );

    // Click backdrop to close
    const backdrop = screen.getByRole('dialog', { hidden: true }).parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('displays metric cards with correct formatting', async () => {
    const mockAnalytics = {
      totalRevenue: 125000.50,
      monthlyRevenue: 18500.25,
      outstandingAmount: 5200.75,
      medicalAidRevenue: 75000.00,
      paidInvoices: 45,
      pendingInvoices: 12,
      revenueGrowth: 12.5,
      avgInvoiceValue: 2500.50,
      topServices: [],
      monthlyTrends: [],
      serviceBreakdown: [],
      paymentStatusBreakdown: []
    };

    // Mock successful data fetch
    (supabase.from as any).mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({
          data: [mockAnalytics],
          error: null
        })
      })
    });

    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('N$125,000.50')).toBeInTheDocument();
      expect(screen.getByText('N$18,500.25')).toBeInTheDocument();
      expect(screen.getByText('N$5,200.75')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    (supabase.from as any).mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({
          data: null,
          error: { message: 'Network error' }
        })
      })
    });

    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No financial data available')).toBeInTheDocument();
    });
  });

  it('renders charts when data is available', async () => {
    const mockAnalytics = {
      totalRevenue: 125000,
      monthlyRevenue: 18500,
      outstandingAmount: 5200,
      medicalAidRevenue: 75000,
      selfPayRevenue: 50000,
      paidInvoices: 45,
      pendingInvoices: 12,
      revenueGrowth: 12.5,
      avgInvoiceValue: 2500,
      topServices: [
        { name: 'Consultation', value: 45000, count: 120 },
        { name: 'X-Ray', value: 25000, count: 80 }
      ],
      monthlyTrends: [
        { month: 'Jan 2024', revenue: 10000, invoices: 25, medical_aid: 6000, self_pay: 4000 }
      ],
      serviceBreakdown: [
        { name: 'Consultation', value: 45000, color: '#8b5cf6' }
      ],
      paymentStatusBreakdown: [
        { status: 'Paid', count: 45, value: 120000, color: '#10b981' }
      ]
    };

    (supabase.from as any).mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({
          data: [mockAnalytics],
          error: null
        })
      })
    });

    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(4);
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  it('uses Rubik font for numerical values', () => {
    render(
      <EnhancedFinancialModal
        isOpen={true}
        onClose={() => {}}
        data={mockFinancialData}
      />
    );

    // Check that numerical elements have proper font family class
    const elements = screen.getAllByText(/N\$|%/);
    elements.forEach(element => {
      expect(element.className).toMatch(/font-rubik|rubik/);
    });
  });
});