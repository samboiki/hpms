import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../stores/themeStore';
import {
  X,
  CreditCard,
  Calendar,
  TrendingUp,
  Receipt,
  DollarSign,
  FileText,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Wallet,
  PieChart,
  BarChart,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';

interface BillingItem {
  id: string;
  date: string;
  /** 'invoice' = a whole invoice (shown with the generic receipt icon) */
  type: 'consultation' | 'procedure' | 'lab' | 'imaging' | 'medication' | 'invoice';
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod?: string;
  invoiceNumber?: string;
}

interface PremiumBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  /** @deprecated Ignored: the total is computed from billingItems */
  totalSpent?: number;
  billingItems?: BillingItem[];
}

// Groups the free-text payment methods stored on invoices into a few readable labels
const formatPaymentMethod = (method?: string): string => {
  if (!method) return 'Not recorded';
  const normalized = method.toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (/medical|aid|scheme|insurance/.test(normalized)) return 'Medical aid';
  if (/cash/.test(normalized)) return 'Cash';
  if (/card|credit|debit|pos/.test(normalized)) return 'Card';
  if (/eft|transfer|bank/.test(normalized)) return 'EFT';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const PremiumBillingModal: React.FC<PremiumBillingModalProps> = ({
  isOpen,
  onClose,
  patientName = 'Patient',
  billingItems = []
}) => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('summary');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Only real billing items are shown. The previous fallback rendered hard-coded demo invoices
  // ("Dr. Smith", INV-2024-00x) inside real patient records whenever no items were passed.
  const items = billingItems;

  // Calculate statistics (total is derived from the items, not a caller-supplied estimate)
  const totalSpent = items.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = items.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const totalPending = items.filter(item => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
  const totalOverdue = items.filter(item => item.status === 'overdue').reduce((sum, item) => sum + item.amount, 0);

  // Real split of what this patient has paid, by payment method (replaces hard-coded 65/25/10%)
  const methodTotals = items
    .filter(item => item.status === 'paid')
    .reduce<Record<string, number>>((acc, item) => {
      const method = formatPaymentMethod(item.paymentMethod);
      acc[method] = (acc[method] || 0) + item.amount;
      return acc;
    }, {});
  const methodBreakdown = Object.entries(methodTotals)
    .map(([method, amount]) => ({ method, amount, percent: totalPaid > 0 ? Math.round((amount / totalPaid) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Billed per month over the last 6 months (replaces the "coming soon" placeholder)
  const monthlySpending = Array.from({ length: 6 }, (_, i) => {
    const month = new Date();
    month.setDate(1);
    month.setMonth(month.getMonth() - (5 - i));
    const key = format(month, 'yyyy-MM');
    const amount = items
      .filter(item => item.date && item.date.slice(0, 7) === key)
      .reduce((sum, item) => sum + item.amount, 0);
    return { key, label: format(month, 'MMM'), amount };
  });
  const maxMonthly = Math.max(0, ...monthlySpending.map(m => m.amount));

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return <FileText className="w-4 h-4" />;
      case 'procedure': return <Activity className="w-4 h-4" />;
      case 'lab': return <TestTube className="w-4 h-4" />;
      case 'imaging': return <ImageIcon className="w-4 h-4" />;
      case 'medication': return <Pill className="w-4 h-4" />;
      default: return <Receipt className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation': return 'from-blue-500 to-indigo-600';
      case 'procedure': return 'from-purple-500 to-pink-600';
      case 'lab': return 'from-emerald-500 to-green-600';
      case 'imaging': return 'from-amber-500 to-orange-600';
      case 'medication': return 'from-red-500 to-rose-600';
      default: return 'from-gray-500 to-slate-600';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <div className="space-y-6">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Investment Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl transform rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">All Time</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Investment</p>
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    N$ {totalSpent.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">Healthcare expenses to date</p>
                </div>
              </motion.div>

              {/* Paid Amount Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-300"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Settled</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Paid Amount</p>
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    N$ {totalPaid.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">Successfully paid</p>
                </div>
              </motion.div>

              {/* Outstanding Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl transform rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Outstanding</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Balance Due</p>
                  <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    N$ {(totalPending + totalOverdue).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">Pending payment</p>
                </div>
              </motion.div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <PieChart className="w-5 h-5 text-purple-600" />
                Payment Methods
              </h4>
              {methodBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">No payments recorded for this patient yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {methodBreakdown.slice(0, 3).map(({ method, amount, percent }) => {
                    const MethodIcon = method === 'Medical aid' ? Wallet : method === 'Cash' ? DollarSign : CreditCard;
                    return (
                      <div key={method} className="text-center p-4 bg-white rounded-xl border border-gray-100">
                        <MethodIcon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700">{method}</p>
                        <p className="text-xl font-bold text-purple-600 tabular-nums">{percent}%</p>
                        <p className="text-xs text-gray-500 mt-1 tabular-nums">
                          N${amount.toLocaleString('en-NA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly billed amounts, last 6 months */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <BarChart className="w-5 h-5 text-blue-600" />
                Billed per month (last 6 months)
              </h4>
              {maxMonthly === 0 ? (
                <p className="text-sm text-gray-500">No billing in the last 6 months.</p>
              ) : (
                <div className="flex items-end gap-3 h-48">
                  {monthlySpending.map(month => (
                    <div key={month.key} className="flex-1 h-full flex flex-col items-center gap-1">
                      <span className="text-[11px] text-gray-600 tabular-nums h-4">
                        {month.amount > 0 ? `N$${Math.round(month.amount).toLocaleString('en-NA')}` : ''}
                      </span>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-purple-500"
                          style={{ height: `${month.amount > 0 ? Math.max((month.amount / maxMonthly) * 100, 4) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{month.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'transactions':
        return (
          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all text-sm"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'paid', 'pending', 'overdue'].map((status) => (
                  <motion.button
                    key={status}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      filterStatus === status
                        ? 'bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-3">
              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  No billing records for this patient yet.
                </div>
              )}
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                  className="relative group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${getTypeColor(item.type)} rounded-xl opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                  <div className="relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 bg-gradient-to-br ${getTypeColor(item.type)} rounded-lg shadow-sm`}>
                          <div className="text-white">{getTypeIcon(item.type)}</div>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{item.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(item.date), 'MMM dd, yyyy')}
                            </span>
                            {item.invoiceNumber && (
                              <span className="flex items-center gap-1">
                                <Receipt className="w-3 h-3" />
                                {item.invoiceNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">N$ {item.amount.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'paid' ? 'bg-green-100 text-green-700' :
                            item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.status === 'paid' ? '✓ Paid' :
                             item.status === 'pending' ? '⏳ Pending' :
                             '⚠️ Overdue'}
                          </span>
                          {item.paymentMethod && (
                            <span className="text-xs text-gray-500">{item.paymentMethod}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 rounded-2xl shadow-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Premium Header */}
        <div className={`relative bg-gradient-to-r ${currentTheme.gradients.sidebar} p-6 text-white`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.gradients.sidebar} opacity-20 backdrop-blur-sm`}></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>Billing & Financial Overview</h2>
                <p className="text-emerald-100 text-sm">
                  {patientName}'s complete financial history
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2 mb-6">
            <motion.button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 ${
                activeTab === 'summary'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <PieChart className="w-4 h-4" />
              <span className="text-sm font-medium">Financial Summary</span>
            </motion.button>
            
            <motion.button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 ${
                activeTab === 'transactions'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Receipt className="w-4 h-4" />
              <span className="text-sm font-medium">Transaction History</span>
            </motion.button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 font-medium text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Generate Invoice
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl flex items-center gap-2 hover:bg-gray-200 transition-all font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                Export Statement
              </motion.button>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium text-sm"
            >
              Close
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

// Add missing imports
import { TestTube, ImageIcon, Pill } from 'lucide-react';

export default PremiumBillingModal;