import React, { useState } from 'react';
import { 
  DollarSign, 
  CreditCard, 
  FileText, 
  TrendingUp,
  Download,
  Filter,
  Search,
  Calendar,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wallet,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Mock data for charts
const revenueData = [
  { month: 'Jan', revenue: 45000, expenses: 32000, profit: 13000 },
  { month: 'Feb', revenue: 52000, expenses: 35000, profit: 17000 },
  { month: 'Mar', revenue: 48000, expenses: 31000, profit: 17000 },
  { month: 'Apr', revenue: 61000, expenses: 38000, profit: 23000 },
  { month: 'May', revenue: 55000, expenses: 34000, profit: 21000 },
  { month: 'Jun', revenue: 67000, expenses: 41000, profit: 26000 },
];

const insuranceClaimsData = [
  { month: 'Jan', submitted: 85, approved: 75, pending: 7, rejected: 3 },
  { month: 'Feb', submitted: 92, approved: 82, pending: 6, rejected: 4 },
  { month: 'Mar', submitted: 78, approved: 70, pending: 5, rejected: 3 },
  { month: 'Apr', submitted: 95, approved: 85, pending: 8, rejected: 2 },
  { month: 'May', submitted: 88, approved: 78, pending: 7, rejected: 3 },
  { month: 'Jun', submitted: 90, approved: 82, pending: 5, rejected: 3 },
];

// Mock data for recent transactions
const recentTransactions = [
  {
    id: 't1',
    date: '2024-03-15',
    patientName: 'John Doe',
    type: 'payment',
    amount: 150.00,
    status: 'completed',
    method: 'credit-card'
  },
  {
    id: 't2',
    date: '2024-03-15',
    patientName: 'Sarah Johnson',
    type: 'insurance-claim',
    amount: 450.00,
    status: 'pending',
    method: 'insurance'
  },
  {
    id: 't3',
    date: '2024-03-14',
    patientName: 'Michael Brown',
    type: 'refund',
    amount: -75.00,
    status: 'completed',
    method: 'bank-transfer'
  },
  {
    id: 't4',
    date: '2024-03-14',
    patientName: 'Emily Wilson',
    type: 'payment',
    amount: 200.00,
    status: 'completed',
    method: 'cash'
  },
];

// Mock data for insurance claims
const insuranceClaims = [
  {
    id: 'c1',
    patientName: 'John Doe',
    provider: 'Blue Cross',
    amount: 850.00,
    submissionDate: '2024-03-10',
    status: 'approved',
    claimNumber: 'CLM001234'
  },
  {
    id: 'c2',
    patientName: 'Sarah Johnson',
    provider: 'Aetna',
    amount: 1200.00,
    submissionDate: '2024-03-12',
    status: 'pending',
    claimNumber: 'CLM001235'
  },
  {
    id: 'c3',
    patientName: 'Michael Brown',
    provider: 'UnitedHealth',
    amount: 675.00,
    submissionDate: '2024-03-13',
    status: 'rejected',
    claimNumber: 'CLM001236'
  },
];

const Finance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'claims' | 'invoices' | 'reports'>('overview');
  const [dateRange, setDateRange] = useState('month');

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center">
          <DollarSign size={28} className="text-brand-primary mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Management</h1>
            <p className="text-gray-600">Track revenue, expenses, and insurance claims</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button variant="outline">
            <FileText size={16} className="mr-2" />
            Generate Report
          </Button>
          <Button>
            <PlusCircle size={16} className="mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-success-100 text-success-600">
                <DollarSign size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">$67,000</h3>
                <p className="text-xs text-success-600">↑ 12% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-warning-100 text-warning-600">
                <Clock size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Claims</p>
                <h3 className="text-2xl font-bold text-gray-900">23</h3>
                <p className="text-xs text-warning-600">$12,450 total value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-error-100 text-error-600">
                <AlertCircle size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue Invoices</p>
                <h3 className="text-2xl font-bold text-gray-900">8</h3>
                <p className="text-xs text-error-600">$3,200 outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-brand-light text-brand-primary">
                <TrendingUp size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Growth</p>
                <h3 className="text-2xl font-bold text-gray-900">15%</h3>
                <p className="text-xs text-success-600">Above target</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'overview'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'claims'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Insurance Claims
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'invoices'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'reports'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reports
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Revenue Overview</CardTitle>
                <div className="flex items-center space-x-2">
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  >
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                  </select>
                  <Button variant="outline" size="sm">
                    <Download size={14} className="mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#01b8d8" name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="#ff6b6b" name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="#00c853" name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Transactions</CardTitle>
                <Button variant="ghost" size="sm">View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Patient</th>
                      <th className="px-6 py-3 text-left">Type</th>
                      <th className="px-6 py-3 text-left">Amount</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.date}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {transaction.patientName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              transaction.type === 'payment' ? 'success' :
                              transaction.type === 'refund' ? 'error' :
                              'warning'
                            }
                            size="sm"
                          >
                            {transaction.type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium ${
                            transaction.amount >= 0 ? 'text-success-600' : 'text-error-600'
                          }`}>
                            ${Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              transaction.status === 'completed' ? 'success' :
                              transaction.status === 'pending' ? 'warning' :
                              'error'
                            }
                            size="sm"
                          >
                            {transaction.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {transaction.method}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'claims' && (
        <div className="space-y-6">
          {/* Claims Overview Chart */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Claims Processing Overview</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Download size={14} className="mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insuranceClaimsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="approved" stackId="a" fill="#00c853" name="Approved" />
                    <Bar dataKey="pending" stackId="a" fill="#ffd54f" name="Pending" />
                    <Bar dataKey="rejected" stackId="a" fill="#ff6b6b" name="Rejected" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Claims */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Claims</CardTitle>
                <Button>Submit New Claim</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                      <th className="px-6 py-3 text-left">Claim #</th>
                      <th className="px-6 py-3 text-left">Patient</th>
                      <th className="px-6 py-3 text-left">Provider</th>
                      <th className="px-6 py-3 text-left">Amount</th>
                      <th className="px-6 py-3 text-left">Submission Date</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {insuranceClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {claim.claimNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">
                            {claim.patientName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">
                            {claim.provider}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            ${claim.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {claim.submissionDate}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              claim.status === 'approved' ? 'success' :
                              claim.status === 'pending' ? 'warning' :
                              'error'
                            }
                            size="sm"
                          >
                            {claim.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Finance;