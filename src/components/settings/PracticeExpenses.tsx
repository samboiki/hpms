import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import DateInput from '../ui/DateInput';
import MonthInput from '../ui/MonthInput';
import { expenseCurrencyLabel, formatExpenseAmount, formatExpenseDate, nonNadCurrencies, toDateValue } from './expenseFormat';

interface Expense {
  id: string;
  practice_id: string;
  branch_id?: string;
  expense_type: string;
  expense_category: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  payment_method?: string;
  payment_frequency?: string;
  vendor_name?: string;
  vendor_contact?: string;
  account_number?: string;
  expense_date: string;
  due_date?: string;
  paid_date?: string;
  next_payment_date?: string;
  status: string;
  is_recurring: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ExpenseTemplate {
  id: string;
  practice_id: string;
  branch_id?: string;
  template_name: string;
  expense_type: string;
  expense_category: string;
  description?: string;
  default_amount?: number;
  currency: string;
  payment_method?: string;
  payment_frequency?: string;
  vendor_name?: string;
  vendor_contact?: string;
  account_number?: string;
  is_active: boolean;
}

interface Branch {
  id: string;
  name: string;
}

// Expense type configuration with icons
const expenseTypes = [
  { value: 'rent', label: 'Rent & Lease', icon: 'solar:building-bold-duotone', color: 'purple' },
  { value: 'utilities', label: 'Utilities', icon: 'solar:lightning-bold-duotone', color: 'yellow' },
  { value: 'insurance', label: 'Insurance', icon: 'solar:shield-check-bold-duotone', color: 'green' },
  { value: 'supplies', label: 'Medical Supplies', icon: 'solar:medical-kit-bold-duotone', color: 'blue' },
  { value: 'equipment', label: 'Equipment', icon: 'solar:settings-bold-duotone', color: 'indigo' },
  { value: 'staff', label: 'Staff & Payroll', icon: 'solar:users-group-two-rounded-bold-duotone', color: 'pink' },
  { value: 'professional_services', label: 'Professional Services', icon: 'solar:briefcase-bold-duotone', color: 'orange' },
  { value: 'marketing', label: 'Marketing', icon: 'solar:megaphone-bold-duotone', color: 'red' },
  { value: 'technology', label: 'Technology & IT', icon: 'solar:laptop-bold-duotone', color: 'cyan' },
  { value: 'regulatory', label: 'Regulatory & Compliance', icon: 'solar:document-text-bold-duotone', color: 'teal' },
  { value: 'maintenance', label: 'Maintenance', icon: 'solar:settings-minimalistic-bold-duotone', color: 'gray' },
  { value: 'other', label: 'Other', icon: 'solar:menu-dots-bold-duotone', color: 'slate' }
];

const expenseCategories = [
  { value: 'fixed_monthly', label: 'Fixed Monthly' },
  { value: 'variable_monthly', label: 'Variable Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One Time' }
];

const paymentMethods = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'debit_order', label: 'Debit Order' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' }
];

const paymentFrequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_monthly', label: 'Bi-Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'once_off', label: 'Once Off' }
];

const PracticeExpenses: React.FC = () => {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'main' | 'branches'>('main');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ExpenseTemplate | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Form state
  const [formData, setFormData] = useState({
    expense_type: 'rent',
    expense_category: 'fixed_monthly',
    name: '',
    description: '',
    amount: 0,
    currency: 'NAD',
    payment_method: '',
    payment_frequency: '',
    vendor_name: '',
    vendor_contact: '',
    account_number: '',
    expense_date: toDateValue(),
    due_date: '',
    paid_date: '',
    next_payment_date: '',
    status: 'pending',
    is_recurring: false
  });

  useEffect(() => {
    if (user?.practice_id) {
      loadData();
    }
  }, [user?.practice_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('practice_id', user?.practice_id)
        .order('name');

      if (branchesError) throw branchesError;
      setBranches(branchesData || []);

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('practice_expenses')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('expense_date', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Load templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('practice_expense_templates')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('template_name');

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load expenses data');
    } finally {
      setLoading(false);
    }
  };

  // In the Branches view a new expense belongs to the selected branch; without one it would be
  // saved to the main practice and vanish from the list the user is looking at
  const isBranchChosenForNewExpense = () => {
    if (activeView === 'branches' && !selectedBranchId) {
      toast.error('Select a branch first, then add the expense.');
      return false;
    }
    return true;
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.practice_id) {
      toast.error('No practice ID found. Please refresh and try again.');
      return;
    }
    if (!editingExpense && !isBranchChosenForNewExpense()) return;

    try {
      const expenseData = {
        ...formData,
        practice_id: user?.practice_id,
        branch_id: activeView === 'branches' ? selectedBranchId : null,
        created_by: user?.id,
        updated_by: user?.id,
        // Convert empty date strings to null
        expense_date: formData.expense_date || null,
        due_date: formData.due_date || null,
        paid_date: formData.paid_date || null,
        next_payment_date: formData.next_payment_date || null
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('practice_expenses')
          .update({
            ...expenseData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('Expense updated successfully');
      } else {
        const { error } = await supabase
          .from('practice_expenses')
          .insert(expenseData);

        if (error) throw error;
        toast.success('Expense added successfully');
      }

      setShowExpenseModal(false);
      setEditingExpense(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Failed to save expense');
    }
  };

  const handleDeleteExpense = async (id: string, name: string) => {
    if (!window.confirm(`Delete the expense "${name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('practice_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Expense deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const handleMarkAsPaid = async (expense: Expense) => {
    try {
      const { error } = await supabase
        .from('practice_expenses')
        .update({
          status: 'paid',
          paid_date: toDateValue(),
          updated_at: new Date().toISOString()
        })
        .eq('id', expense.id);

      if (error) throw error;
      toast.success('Expense marked as paid');
      loadData();
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Failed to update expense');
    }
  };

  const handleCreateFromTemplate = (template: ExpenseTemplate) => {
    if (!isBranchChosenForNewExpense()) return;
    setFormData({
      expense_type: template.expense_type,
      expense_category: template.expense_category,
      name: template.template_name,
      description: template.description || '',
      amount: template.default_amount || 0,
      currency: template.currency,
      payment_method: template.payment_method || '',
      payment_frequency: template.payment_frequency || '',
      vendor_name: template.vendor_name || '',
      vendor_contact: template.vendor_contact || '',
      account_number: template.account_number || '',
      expense_date: toDateValue(),
      due_date: '',
      paid_date: '',
      next_payment_date: '',
      status: 'pending',
      is_recurring: template.payment_frequency !== 'once_off'
    });
    setShowExpenseModal(true);
  };

  const resetForm = () => {
    setFormData({
      expense_type: 'rent',
      expense_category: 'fixed_monthly',
      name: '',
      description: '',
      amount: 0,
      currency: 'NAD',
      payment_method: '',
      payment_frequency: '',
      vendor_name: '',
      vendor_contact: '',
      account_number: '',
      expense_date: toDateValue(),
      due_date: '',
      paid_date: '',
      next_payment_date: '',
      status: 'pending',
      is_recurring: false
    });
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    // With no branch picked, null === null would list the main practice's expenses as a branch's
    const matchesBranch = activeView === 'main'
      ? !expense.branch_id
      : !!selectedBranchId && expense.branch_id === selectedBranchId;
    const matchesType = filterType === 'all' || expense.expense_type === filterType;
    const matchesStatus = filterStatus === 'all' || expense.status === filterStatus;
    
    return matchesBranch && matchesType && matchesStatus;
  });

  // Calculate totals by category
  const calculateTotals = () => {
    const totals = {
      fixed_monthly: 0,
      variable_monthly: 0,
      quarterly: 0,
      annual: 0,
      one_time: 0,
      total: 0
    };

    filteredExpenses.forEach(expense => {
      if (expense.status !== 'cancelled') {
        totals[expense.expense_category as keyof typeof totals] += expense.amount;
        totals.total += expense.amount;
      }
    });

    return totals;
  };

  const totals = calculateTotals();
  // The totals add every amount as N$; name any other currency they include
  const totalsOtherCurrencies = nonNadCurrencies(filteredExpenses.filter(expense => expense.status !== 'cancelled'));

  // Get expense type info
  const getExpenseTypeInfo = (type: string) => {
    return expenseTypes.find(t => t.value === type) || expenseTypes[expenseTypes.length - 1];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Practice Expenses</h2>
            <p className="text-gray-600 mt-1">Track and manage all your practice expenses</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTemplateModal(true)}
              className="border-purple-200 text-purple-600 hover:bg-purple-50"
            >
              <Icon icon="solar:document-add-bold-duotone" className="w-5 h-5 mr-2" />
              Templates
            </Button>
            <Button
              onClick={() => {
                if (!isBranchChosenForNewExpense()) return;
                setEditingExpense(null);
                resetForm();
                setShowExpenseModal(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('main')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'main'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon icon="solar:building-bold-duotone" className="w-4 h-4" />
              Main Practice
            </button>
            <button
              onClick={() => setActiveView('branches')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'branches'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon icon="solar:buildings-bold-duotone" className="w-4 h-4" />
              Branches
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Show expenses as cards"
                title="Card view"
                className={`p-2 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon="solar:widget-2-bold-duotone" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="Show expenses as a table"
                title="Table view"
                className={`p-2 rounded transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon="solar:list-bold-duotone" className="w-4 h-4" />
              </button>
            </div>

            {/* Filters */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              {expenseTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>

        {/* Branch Selection (when in branches view) */}
        {activeView === 'branches' && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">Select a branch to view expenses:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedBranchId === branch.id
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">{branch.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">Fixed Monthly</p>
            <p className="text-xl font-bold text-gray-900">
              {formatExpenseAmount(totals.fixed_monthly, 'NAD')}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">Variable Monthly</p>
            <p className="text-xl font-bold text-gray-900">
              {formatExpenseAmount(totals.variable_monthly, 'NAD')}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">Quarterly</p>
            <p className="text-xl font-bold text-gray-900">
              {formatExpenseAmount(totals.quarterly, 'NAD')}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">Annual</p>
            <p className="text-xl font-bold text-gray-900">
              {formatExpenseAmount(totals.annual, 'NAD')}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">One Time</p>
            <p className="text-xl font-bold text-gray-900">
              {formatExpenseAmount(totals.one_time, 'NAD')}
            </p>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-4">
            <p className="text-sm opacity-90">Total Active</p>
            <p className="text-xl font-bold">
              {formatExpenseAmount(totals.total, 'NAD')}
            </p>
          </div>
        </div>
        {totalsOtherCurrencies.length > 0 && (
          <p className="-mt-3 mb-6 text-xs text-gray-500">
            Totals include {totalsOtherCurrencies.join(', ')} amounts counted 1:1 as N$.
          </p>
        )}

        {/* Expenses Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExpenses.map(expense => {
              const typeInfo = getExpenseTypeInfo(expense.expense_type);
              return (
                <motion.div
                  key={expense.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${typeInfo.color}-100 rounded-lg`}>
                        <Icon icon={typeInfo.icon} className={`w-5 h-5 text-${typeInfo.color}-600`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{expense.name}</h4>
                        <p className="text-xs text-gray-500">{typeInfo.label}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      expense.status === 'paid' ? 'bg-green-100 text-green-700' :
                      expense.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      expense.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {expense.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-900">
                        {formatExpenseAmount(expense.amount, expense.currency)}
                      </span>
                    </div>
                    {expense.vendor_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vendor:</span>
                        <span className="text-gray-900">{expense.vendor_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="text-gray-900">
                        {formatExpenseDate(expense.due_date)}
                      </span>
                    </div>
                    {expense.is_recurring && (
                      <div className="flex items-center gap-1 text-purple-600">
                        <Icon icon="solar:repeat-bold-duotone" className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {paymentFrequencies.find(f => f.value === expense.payment_frequency)?.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    {expense.status === 'pending' && (
                      <button
                        onClick={() => handleMarkAsPaid(expense)}
                        className="flex-1 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        Mark as Paid
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingExpense(expense);
                        setFormData({
                          expense_type: expense.expense_type,
                          expense_category: expense.expense_category,
                          name: expense.name,
                          description: expense.description || '',
                          amount: expense.amount,
                          currency: expense.currency,
                          payment_method: expense.payment_method || '',
                          payment_frequency: expense.payment_frequency || '',
                          vendor_name: expense.vendor_name || '',
                          vendor_contact: expense.vendor_contact || '',
                          account_number: expense.account_number || '',
                          expense_date: expense.expense_date,
                          due_date: expense.due_date || '',
                          // Saving maps a missing value to null, so leaving these out erased them
                          paid_date: expense.paid_date || '',
                          next_payment_date: expense.next_payment_date || '',
                          status: expense.status,
                          is_recurring: expense.is_recurring
                        });
                        setShowExpenseModal(true);
                      }}
                      className="flex-1 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(expense.id, expense.name)}
                      aria-label={`Delete expense ${expense.name}`}
                      title="Delete expense"
                      className="py-1.5 px-3 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Expense
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredExpenses.map(expense => {
                  const typeInfo = getExpenseTypeInfo(expense.expense_type);
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 bg-${typeInfo.color}-100 rounded`}>
                            <Icon icon={typeInfo.icon} className={`w-4 h-4 text-${typeInfo.color}-600`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{expense.name}</p>
                            {expense.is_recurring && (
                              <p className="text-xs text-purple-600 flex items-center gap-1">
                                <Icon icon="solar:repeat-bold-duotone" className="w-3 h-3" />
                                {paymentFrequencies.find(f => f.value === expense.payment_frequency)?.label}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{typeInfo.label}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatExpenseAmount(expense.amount, expense.currency)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{expense.vendor_name || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">
                          {formatExpenseDate(expense.due_date)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          expense.status === 'paid' ? 'bg-green-100 text-green-700' :
                          expense.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          expense.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {expense.status === 'pending' && (
                            <button
                              onClick={() => handleMarkAsPaid(expense)}
                              className="text-green-600 hover:text-green-700"
                              aria-label={`Mark expense ${expense.name} as paid`}
                              title="Mark as paid"
                            >
                              <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingExpense(expense);
                              setFormData({
                                expense_type: expense.expense_type,
                                expense_category: expense.expense_category,
                                name: expense.name,
                                description: expense.description || '',
                                amount: expense.amount,
                                currency: expense.currency,
                                payment_method: expense.payment_method || '',
                                payment_frequency: expense.payment_frequency || '',
                                vendor_name: expense.vendor_name || '',
                                vendor_contact: expense.vendor_contact || '',
                                account_number: expense.account_number || '',
                                expense_date: expense.expense_date,
                                due_date: expense.due_date || '',
                                paid_date: expense.paid_date || '',
                                next_payment_date: expense.next_payment_date || '',
                                status: expense.status,
                                is_recurring: expense.is_recurring
                              });
                              setShowExpenseModal(true);
                            }}
                            className="text-purple-600 hover:text-purple-700"
                            aria-label={`Edit expense ${expense.name}`}
                            title="Edit expense"
                          >
                            <Icon icon="solar:pen-bold-duotone" className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id, expense.name)}
                            className="text-red-600 hover:text-red-700"
                            aria-label={`Delete expense ${expense.name}`}
                            title="Delete expense"
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <Icon icon="solar:wallet-bold-duotone" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">No expenses found</p>
            <p className="text-sm text-gray-500 mt-1">
              {activeView === 'branches' && !selectedBranchId 
                ? 'Select a branch to view expenses' 
                : 'Add your first expense to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden m-4"
            >
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Expense Templates
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowTemplateModal(false)}
                    aria-label="Close expense templates"
                    title="Close"
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                <p className="text-sm text-gray-600 mb-6">
                  Use templates to quickly create recurring expenses with pre-filled information
                </p>

                {templates.length === 0 ? (
                  <div className="text-center py-12">
                    <Icon icon="solar:document-text-bold-duotone" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 font-medium">No templates available</p>
                    <p className="text-sm text-gray-500 mt-1">Templates will appear here once created</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map(template => {
                      const typeInfo = getExpenseTypeInfo(template.expense_type);
                      return (
                        <div
                          key={template.id}
                          className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group"
                          onClick={() => {
                            handleCreateFromTemplate(template);
                            setShowTemplateModal(false);
                          }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 bg-${typeInfo.color}-100 rounded-lg`}>
                                <Icon icon={typeInfo.icon} className={`w-5 h-5 text-${typeInfo.color}-600`} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                                  {template.template_name}
                                </h4>
                                <p className="text-xs text-gray-500">{typeInfo.label}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            {template.description && (
                              <p className="text-gray-600 text-xs">{template.description}</p>
                            )}
                            {!!template.default_amount && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Default Amount:</span>
                                <span className="font-semibold text-gray-900">
                                  {formatExpenseAmount(Number(template.default_amount), template.currency)}
                                </span>
                              </div>
                            )}
                            {template.vendor_name && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Vendor:</span>
                                <span className="text-gray-900">{template.vendor_name}</span>
                              </div>
                            )}
                            {template.payment_frequency && (
                              <div className="flex items-center gap-1 text-purple-600">
                                <Icon icon="solar:repeat-bold-duotone" className="w-4 h-4" />
                                <span className="text-xs font-medium">
                                  {paymentFrequencies.find(f => f.value === template.payment_frequency)?.label}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <button className="w-full py-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors text-sm font-medium">
                              Use This Template
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 inline mr-1 text-purple-500" />
                    Tip: Templates are automatically created when you add recurring expenses
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden m-4"
            >
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Icon icon="solar:wallet-bold-duotone" className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowExpenseModal(false);
                      setEditingExpense(null);
                      resetForm();
                    }}
                    aria-label="Close without saving"
                    title="Close"
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitExpense} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-100px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expense Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.expense_type}
                      onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      {expenseTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.expense_category}
                      onChange={(e) => setFormData({ ...formData, expense_category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      {expenseCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expense Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Office Rent - Main Building"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      rows={2}
                      placeholder="Additional details about this expense..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-gray-500">
                        {expenseCurrencyLabel(formData.currency)}
                      </span>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-14 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="NAD">NAD - Namibian Dollar</option>
                      <option value="ZAR">ZAR - South African Rand</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select method</option>
                      {paymentMethods.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Frequency
                    </label>
                    <select
                      value={formData.payment_frequency}
                      onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select frequency</option>
                      {paymentFrequencies.map(freq => (
                        <option key={freq.value} value={freq.value}>{freq.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor Name
                    </label>
                    <input
                      type="text"
                      value={formData.vendor_name}
                      onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Property Management Co."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor Contact
                    </label>
                    <input
                      type="text"
                      value={formData.vendor_contact}
                      onChange={(e) => setFormData({ ...formData, vendor_contact: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Phone or email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Reference or account number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expense Date <span className="text-red-500">*</span>
                    </label>
                    <DateInput
                      value={formData.expense_date}
                      onChange={(date) => setFormData({ ...formData, expense_date: date })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <DateInput
                      value={formData.due_date}
                      onChange={(date) => setFormData({ ...formData, due_date: date })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_recurring"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="is_recurring" className="ml-2 text-sm text-gray-700">
                      This is a recurring expense
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowExpenseModal(false);
                      setEditingExpense(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  >
                    <Icon icon={editingExpense ? "solar:diskette-bold-duotone" : "solar:add-circle-bold-duotone"} className="w-5 h-5 mr-2" />
                    {editingExpense ? 'Update Expense' : 'Add Expense'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PracticeExpenses;