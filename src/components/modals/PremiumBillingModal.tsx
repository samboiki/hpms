import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  type: 'consultation' | 'procedure' | 'lab' | 'imaging' | 'medication';
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
  totalSpent?: number;
  billingItems?: BillingItem[];
}

const PremiumBillingModal: React.FC<PremiumBillingModalProps> = ({
  isOpen,
  onClose,
  patientName = 'Patient',
  totalSpent = 0,
  billingItems = []
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Mock data for demonstration
  const mockBillingItems: BillingItem[] = [
    {
      id: '1',
      date: '2024-01-15',
      type: 'consultation',
      description: 'General Consultation - Dr. Smith',
      amount: 450,
      status: 'paid',
      paymentMethod: 'Medical Aid',
      invoiceNumber: 'INV-2024-001'
    },
    {
      id: '2',
      date: '2024-01-20',
      type: 'lab',
      description: 'Blood Test - Complete Blood Count',
      amount: 320,
      status: 'paid',
      paymentMethod: 'Cash',
      invoiceNumber: 'INV-2024-002'
    },
    {
      id: '3',
      date: '2024-02-05',
      type: 'procedure',
      description: 'Minor Surgery - Wound Suturing',
      amount: 850,
      status: 'pending',
      invoiceNumber: 'INV-2024-003'
    },
    {
      id: '4',
      date: '2024-02-10',
      type: 'imaging',
      description: 'X-Ray - Chest',
      amount: 580,
      status: 'paid',
      paymentMethod: 'Medical Aid',
      invoiceNumber: 'INV-2024-004'
    },
    {
      id: '5',
      date: '2024-02-15',
      type: 'medication',
      description: 'Prescription Medication - 30 days',
      amount: 245,
      status: 'overdue',
      invoiceNumber: 'INV-2024-005'
    }
  ];

  const items = billingItems.length > 0 ? billingItems : mockBillingItems;
  
  // Calculate statistics
  const totalPaid = items.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const totalPending = items.filter(item => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
  const totalOverdue = items.filter(item => item.status === 'overdue').reduce((sum, item) => sum + item.amount, 0);
  
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <Wallet className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Medical Aid</p>
                  <p className="text-xl font-bold text-blue-600">65%</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Cash</p>
                  <p className="text-xl font-bold text-green-600">25%</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <CreditCard className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Card</p>
                  <p className="text-xl font-bold text-purple-600">10%</p>
                </div>
              </div>
            </div>

            {/* Spending Trend Chart (Placeholder) */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <BarChart className="w-5 h-5 text-blue-600" />
                Monthly Spending Trend
              </h4>
              <div className="h-48 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Chart visualization coming soon</p>
              </div>
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 rounded-2xl shadow-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 backdrop-blur-sm"></div>
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
    </div>
  );
};

// Add missing imports
import { TestTube, ImageIcon, Pill } from 'lucide-react';

export default PremiumBillingModal;