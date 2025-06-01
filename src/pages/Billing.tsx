import React from 'react';
import { 
  CreditCard, 
  DollarSign, 
  FileText, 
  Calendar, 
  BarChart3,
  Download,
  User,
  Search,
  Filter
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface Invoice {
  id: string;
  patientName: string;
  patientId: string;
  date: string;
  amount: number;
  service: string;
  status: 'paid' | 'pending' | 'overdue';
  insuranceCoverage?: number;
}

// Mock data
const mockInvoices: Invoice[] = [
  {
    id: 'INV-001',
    patientName: 'John Doe',
    patientId: '1',
    date: '2023-10-15',
    amount: 150,
    service: 'Physical Examination',
    status: 'paid',
    insuranceCoverage: 100,
  },
  {
    id: 'INV-002',
    patientName: 'Sarah Johnson',
    patientId: '2',
    date: '2023-10-22',
    amount: 85,
    service: 'Consultation',
    status: 'pending',
    insuranceCoverage: 50,
  },
  {
    id: 'INV-003',
    patientName: 'Robert Williams',
    patientId: '3',
    date: '2023-10-30',
    amount: 200,
    service: 'Lab Tests',
    status: 'overdue',
    insuranceCoverage: 150,
  },
  {
    id: 'INV-004',
    patientName: 'John Doe',
    patientId: '1',
    date: '2023-11-05',
    amount: 120,
    service: 'Follow-up',
    status: 'paid',
    insuranceCoverage: 80,
  },
  {
    id: 'INV-005',
    patientName: 'Sarah Johnson',
    patientId: '2',
    date: '2023-11-10',
    amount: 95,
    service: 'Prescription Refill',
    status: 'pending',
  },
];

const Billing: React.FC = () => {
  // Calculate financial summaries
  const totalRevenue = mockInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  
  const pendingAmount = mockInvoices
    .filter(inv => inv.status === 'pending')
    .reduce((sum, inv) => sum + inv.amount, 0);
  
  const overdueAmount = mockInvoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <CreditCard size={28} className="text-primary-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing & Finances</h1>
            <p className="text-gray-600">Manage invoices, payments, and financial records</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button variant="outline">
            <FileText size={16} className="mr-2" />
            Reports
          </Button>
          <Button>
            <DollarSign size={16} className="mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-success-100 text-success-600">
                <DollarSign size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">${totalRevenue}</h3>
                <p className="text-xs text-gray-500">This month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-warning-100 text-warning-600">
                <Calendar size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <h3 className="text-2xl font-bold text-gray-900">${pendingAmount}</h3>
                <p className="text-xs text-gray-500">{mockInvoices.filter(inv => inv.status === 'pending').length} invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-error-100 text-error-600">
                <BarChart3 size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <h3 className="text-2xl font-bold text-gray-900">${overdueAmount}</h3>
                <p className="text-xs text-gray-500">{mockInvoices.filter(inv => inv.status === 'overdue').length} invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search invoices by ID, patient name, or service"
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-3">
              <select className="px-4 py-2 rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500">
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
              <Button variant="outline">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3 text-left">Invoice</th>
                  <th className="px-6 py-3 text-left">Patient</th>
                  <th className="px-6 py-3 text-left">Service</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Amount</th>
                  <th className="px-6 py-3 text-left">Insurance</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {invoice.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <User size={14} className="text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-900">{invoice.patientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {invoice.service}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {invoice.date}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      ${invoice.amount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {invoice.insuranceCoverage ? `$${invoice.insuranceCoverage}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          invoice.status === 'paid' ? 'success' :
                          invoice.status === 'pending' ? 'warning' :
                          'error'
                        }
                        size="sm"
                      >
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <Button variant="ghost" size="sm">
                        <Download size={14} className="mr-1" />
                        PDF
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
    </div>
  );
};

export default Billing;