import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  FileText, 
  Calendar, 
  BarChart3,
  Download,
  User,
  Search,
  Filter,
  GitBranch,
  Eye,
  Stethoscope,
  Shield,
  Code
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface VisitWithServices {
  id: string;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  diagnosis: string;
  status: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    medical_aid_details?: Array<{
      provider: string;
      scheme_name: string;
    }>;
  };
  visit_services: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    practice_tariffs: {
      code: string;
      namaf_prace_2025: string;
      category: string;
      subcategory?: string;
    };
  }>;
  invoices_enhanced?: Array<{
    id: string;
    invoice_number: string;
    payment_status: string;
    total: number;
  }>;
}

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const [visitsWithServices, setVisitsWithServices] = useState<VisitWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<VisitWithServices | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch visits with services and billing information
  useEffect(() => {
    fetchVisitsWithServices();
  }, []);

  const fetchVisitsWithServices = async () => {
    try {
      setLoading(true);
      
      // Get current user's practice
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: userData } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user.id)
        .single();

      if (!userData?.practice_id) throw new Error('No practice found for user');

      // Fetch visits with services and patient info
      const { data, error } = await supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          visit_time,
          visit_type,
          diagnosis,
          status,
          patient:patients(
            id,
            first_name,
            last_name,
            medical_aid_details(
              provider,
              scheme_name
            )
          ),
          visit_services(
            id,
            quantity,
            unit_price,
            total_price,
            practice_tariffs(
              code,
              namaf_prace_2025,
              category,
              subcategory
            )
          ),
          invoices_enhanced(
            id,
            invoice_number,
            payment_status,
            total
          )
        `)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });

      if (error) throw error;

      // Filter visits that have services
      const visitsWithBilling = (data || []).filter(visit => 
        visit.visit_services && visit.visit_services.length > 0
      );

      setVisitsWithServices(visitsWithBilling);
    } catch (error) {
      console.error('Error fetching visits with services:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate financial summaries
  const calculateFinancials = () => {
    let totalRevenue = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;

    visitsWithServices.forEach(visit => {
      const visitTotal = visit.visit_services.reduce((sum, service) => sum + service.total_price, 0);
      
      if (visit.invoices_enhanced && visit.invoices_enhanced.length > 0) {
        const invoice = visit.invoices_enhanced[0];
        if (invoice.payment_status === 'paid') {
          totalRevenue += invoice.total;
        } else if (invoice.payment_status === 'pending') {
          pendingAmount += invoice.total;
        } else if (invoice.payment_status === 'overdue') {
          overdueAmount += invoice.total;
        }
      } else {
        // No invoice yet, count as pending
        pendingAmount += visitTotal;
      }
    });

    return { totalRevenue, pendingAmount, overdueAmount };
  };

  const { totalRevenue, pendingAmount, overdueAmount } = calculateFinancials();

  // Filter visits based on search and status
  const filteredVisits = visitsWithServices.filter(visit => {
    const patientName = `${visit.patient.first_name} ${visit.patient.last_name}`.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      patientName.includes(searchTerm.toLowerCase()) ||
      visit.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.visit_services.some(service => 
        service.practice_tariffs.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.practice_tariffs.namaf_prace_2025.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const invoiceStatus = visit.invoices_enhanced?.[0]?.payment_status || 'pending';
    const matchesStatus = statusFilter === '' || invoiceStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
          <Button 
            variant="outline"
            onClick={() => navigate('/billing/workflow')}
          >
            <GitBranch size={16} className="mr-2" />
            Workflow
          </Button>
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
                placeholder="Search by patient name, diagnosis, or service code"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-3">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
              <Button variant="outline" onClick={fetchVisitsWithServices}>
                <Filter size={16} className="mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visits with Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Visit Billing Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d4]"></div>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No visits with billing information found</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {filteredVisits.map((visit) => {
                const visitTotal = visit.visit_services.reduce((sum, service) => sum + service.total_price, 0);
                const invoice = visit.invoices_enhanced?.[0];
                const hasMedicalAid = visit.patient.medical_aid_details && visit.patient.medical_aid_details.length > 0;
                
                return (
                  <motion.div
                    key={visit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedVisit(visit)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {visit.patient.first_name} {visit.patient.last_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {visit.visit_date} at {visit.visit_time} - {visit.visit_type}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#01b9d4]">N$ {visitTotal.toFixed(2)}</p>
                        {invoice ? (
                          <Badge
                            variant={
                              invoice.payment_status === 'paid' ? 'success' :
                              invoice.payment_status === 'pending' ? 'warning' :
                              'error'
                            }
                            size="sm"
                          >
                            {invoice.invoice_number} - {invoice.payment_status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" size="sm">No Invoice</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Stethoscope className="w-4 h-4 mr-2" />
                        <span className="font-medium">Diagnosis:</span>
                        <span className="ml-2">{visit.diagnosis}</span>
                      </div>
                      
                      {hasMedicalAid && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Shield className="w-4 h-4 mr-2 text-green-500" />
                          <span>{visit.patient.medical_aid_details[0].provider} - {visit.patient.medical_aid_details[0].scheme_name}</span>
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Services Rendered:</p>
                        <div className="space-y-1">
                          {visit.visit_services.map((service) => (
                            <div key={service.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                              <div className="flex items-center">
                                <Code className="w-4 h-4 mr-2 text-gray-400" />
                                <span className="font-mono font-medium mr-2">{service.practice_tariffs.code}</span>
                                <span className="text-gray-600">{service.practice_tariffs.namaf_prace_2025}</span>
                                {service.quantity > 1 && (
                                  <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">×{service.quantity}</span>
                                )}
                              </div>
                              <span className="font-medium">N$ {service.total_price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Service Details Modal */}
      <AnimatePresence>
        {selectedVisit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedVisit(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Visit Billing Details</h2>
                  <button
                    onClick={() => setSelectedVisit(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Patient Information</h3>
                    <p className="text-sm text-gray-600">
                      <strong>Name:</strong> {selectedVisit.patient.first_name} {selectedVisit.patient.last_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Visit Date:</strong> {selectedVisit.visit_date} at {selectedVisit.visit_time}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Visit Type:</strong> {selectedVisit.visit_type}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Diagnosis:</strong> {selectedVisit.diagnosis}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Services Breakdown</h3>
                    <table className="w-full">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2 text-left">Code</th>
                          <th className="px-4 py-2 text-left">Description</th>
                          <th className="px-4 py-2 text-center">Qty</th>
                          <th className="px-4 py-2 text-right">Unit Price</th>
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedVisit.visit_services.map((service) => (
                          <tr key={service.id}>
                            <td className="px-4 py-3 text-sm font-mono">{service.practice_tariffs.code}</td>
                            <td className="px-4 py-3 text-sm">
                              {service.practice_tariffs.namaf_prace_2025}
                              <br />
                              <span className="text-xs text-gray-500">
                                {service.practice_tariffs.category}
                                {service.practice_tariffs.subcategory && ` - ${service.practice_tariffs.subcategory}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">{service.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right">N$ {service.unit_price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium">N$ {service.total_price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-medium text-right">Total:</td>
                          <td className="px-4 py-3 text-lg font-bold text-right text-[#01b9d4]">
                            N$ {selectedVisit.visit_services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    {!selectedVisit.invoices_enhanced?.length && (
                      <Button>
                        <FileText size={16} className="mr-2" />
                        Generate Invoice
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setSelectedVisit(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default Billing;