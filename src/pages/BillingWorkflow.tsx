import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { EXCLUDE_CARRIER_VISITS } from '../utils/carrierVisits';
import {
  Activity, 
  FileText, 
  CreditCard, 
  Users, 
  Database,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Package,
  Zap,
  Heart,
  ClipboardList,
  Receipt
} from 'lucide-react';

// null = the count could not be loaded (query failed or the table does not exist), shown as "-"
interface TableStats {
  patients: number | null;
  visits: number | null;
  invoices: number | null;
  invoiceItems: number | null;
  visitServices: number | null;
  practiceTariffs: number | null;
  medicalAidCoverage: number | null;
  paymentRecords: number | null;
}

const countOf = (res: { count: number | null; error: unknown }): number | null =>
  res.error ? null : res.count ?? 0;

const formatCount = (value: number | null): string => (value === null ? '-' : value.toLocaleString());

interface WorkflowNode {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  tables: string[];
  components: string[];
  actions: string[];
  expanded?: boolean;
  children?: WorkflowNode[];
}

export default function BillingWorkflow() {
  const [stats, setStats] = useState<TableStats>({
    patients: 0,
    visits: 0,
    invoices: 0,
    invoiceItems: 0,
    visitServices: 0,
    practiceTariffs: 0,
    medicalAidCoverage: 0,
    paymentRecords: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1']));

  // Fetch live statistics
  useEffect(() => {
    fetchTableStats();
  }, []);

  const fetchTableStats = async () => {
    setLoading(true);
    try {
      const [
        patientsCount,
        visitsCount,
        invoicesCount,
        invoiceItemsCount,
        visitServicesCount,
        practiceTariffsCount,
        medicalAidCoverageCount,
        paymentRecordsCount
      ] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        // Rows that only carry invoices (payment plans, packages, opening balances) are not visits
        supabase.from('visits').select('id', { count: 'exact', head: true }).or(EXCLUDE_CARRIER_VISITS),
        supabase.from('invoices_enhanced').select('id', { count: 'exact', head: true }),
        supabase.from('invoice_items_enhanced').select('id', { count: 'exact', head: true }),
        supabase.from('visit_services').select('id', { count: 'exact', head: true }),
        supabase.from('practice_tariffs').select('id', { count: 'exact', head: true }),
        supabase.from('medical_aid_coverage').select('id', { count: 'exact', head: true }),
        supabase.from('payment_records').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        patients: countOf(patientsCount),
        visits: countOf(visitsCount),
        invoices: countOf(invoicesCount),
        invoiceItems: countOf(invoiceItemsCount),
        visitServices: countOf(visitServicesCount),
        practiceTariffs: countOf(practiceTariffsCount),
        medicalAidCoverage: countOf(medicalAidCoverageCount),
        paymentRecords: countOf(paymentRecordsCount)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const workflowTree: WorkflowNode[] = [
    {
      id: '1',
      title: 'Patient Journey',
      description: 'The complete flow from patient arrival to payment',
      icon: Heart,
      color: 'from-blue-500 to-cyan-500',
      tables: [],
      components: [],
      actions: [],
      children: [
        {
          id: '1.1',
          title: 'Patient Registration',
          description: 'New patient arrives and gets registered in the system',
          icon: Users,
          color: 'from-green-500 to-emerald-500',
          tables: ['patients', 'medical_aid_details'],
          components: ['PatientRegistrationForm', 'MedicalAidForm'],
          actions: [
            'Receptionist creates new patient record',
            'Captures personal and contact details',
            'Records medical aid information if applicable',
            'Assigns patient ID for tracking'
          ]
        },
        {
          id: '1.2',
          title: 'Clinical Visit',
          description: 'Doctor sees patient and provides medical services',
          icon: Activity,
          color: 'from-purple-500 to-pink-500',
          tables: ['visits', 'vitals'],
          components: ['AddVisitForm', 'VitalsForm'],
          actions: [
            'Create new visit record',
            'Record vital signs (BP, temp, etc)',
            'Document chief complaint',
            'Make diagnosis',
            'Plan treatment'
          ],
          children: [
            {
              id: '1.2.1',
              title: 'Service Selection',
              description: 'Doctor selects all services provided during visit',
              icon: Package,
              color: 'from-orange-500 to-red-500',
              tables: ['practice_tariffs', 'visit_services'],
              components: ['ServiceSelector'],
              actions: [
                'Search available services',
                'Select procedures performed',
                'Adjust quantities',
                'Add service notes'
              ]
            },
            {
              id: '1.2.2',
              title: 'Medical Aid Check',
              description: 'System checks what medical aid will cover',
              icon: CheckCircle,
              color: 'from-teal-500 to-green-500',
              tables: ['medical_aid_coverage'],
              components: ['Coverage indicators in ServiceSelector'],
              actions: [
                'Verify patient has active medical aid',
                'Check coverage for each service',
                'Calculate covered amounts',
                'Flag pre-authorization needs'
              ]
            }
          ]
        },
        {
          id: '1.3',
          title: 'Invoice Generation',
          description: 'System creates invoice from visit services',
          icon: FileText,
          color: 'from-indigo-500 to-purple-500',
          tables: ['invoices_enhanced', 'invoice_items_enhanced'],
          components: ['Invoice generation in AddVisitForm'],
          actions: [
            'Auto-generate invoice number',
            'Calculate service totals',
            'Apply medical aid coverage',
            'Add 15% VAT tax',
            'Create line items',
            'Link to visit record'
          ]
        },
        {
          id: '1.4',
          title: 'Payment Processing',
          description: 'Patient makes payment and receives receipt',
          icon: CreditCard,
          color: 'from-green-500 to-teal-500',
          tables: ['payment_records'],
          components: ['Payment section in Finance page'],
          actions: [
            'Select payment method',
            'Record payment amount',
            'Generate transaction reference',
            'Update invoice status',
            'Issue receipt',
            'Submit medical aid claim'
          ]
        }
      ]
    }
  ];

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderWorkflowNode = (node: WorkflowNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    const Icon = node.icon;

    return (
      <div key={node.id} className={`${level > 0 ? 'ml-8' : ''}`}>
        <div
          className={`relative cursor-pointer transition-all duration-300 ${
            isSelected ? 'scale-105' : ''
          }`}
          onClick={() => setSelectedNode(node.id)}
        >
          <div className={`
            bg-gradient-to-r ${node.color} p-1 rounded-xl mb-4
            ${isSelected ? 'shadow-2xl' : 'shadow-lg hover:shadow-xl'}
          `}>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`
                    bg-gradient-to-r ${node.color} p-3 rounded-lg
                    text-white shadow-lg
                  `}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {node.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {node.description}
                    </p>
                    
                    {node.tables.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center space-x-2 text-sm">
                          <Database className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Database Tables:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {node.tables.map(table => (
                            <span
                              key={table}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                            >
                              {table}
                              {table === 'patients' && ` (${formatCount(stats.patients)})`}
                              {table === 'visits' && ` (${formatCount(stats.visits)})`}
                              {table === 'invoices_enhanced' && ` (${formatCount(stats.invoices)})`}
                              {table === 'practice_tariffs' && ` (${formatCount(stats.practiceTariffs)})`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {node.actions.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center space-x-2 text-sm">
                          <Zap className="w-4 h-4 text-orange-500" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            What happens:
                          </span>
                        </div>
                        <ul className="mt-1 space-y-1">
                          {node.actions.map((action, idx) => (
                            <li key={idx} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="text-green-500 mt-0.5">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {node.components.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center space-x-2 text-sm">
                          <ClipboardList className="w-4 h-4 text-purple-500" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            UI Components:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {node.components.map(component => (
                            <span
                              key={component}
                              className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium"
                            >
                              {component}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {node.children && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeExpansion(node.id);
                    }}
                    className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label={isExpanded ? `Hide steps under ${node.title}` : `Show steps under ${node.title}`}
                    title={isExpanded ? 'Hide steps' : 'Show steps'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connection line to children */}
          {node.children && isExpanded && (
            <div className="absolute left-12 top-full w-0.5 bg-gradient-to-b from-gray-300 to-transparent h-8 -mt-4"></div>
          )}
        </div>

        {/* Render children */}
        {node.children && isExpanded && (
          <div className="relative">
            {node.children.map((child, idx) => (
              <div key={child.id}>
                {idx < node.children!.length - 1 && (
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                )}
                <div className="relative">
                  <div className="absolute left-4 top-12 w-8 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
                  {renderWorkflowNode(child, level + 1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Billing Workflow Visualization
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Interactive guide to understand how billing works in HPMS
              </p>
            </div>
            <button
              onClick={fetchTableStats}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Activity className="w-4 h-4" />
              <span>Refresh Stats</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Total Patients</p>
                  <p className="text-3xl font-bold mt-2">
                    {loading ? '...' : formatCount(stats.patients)}
                  </p>
                </div>
                <Users className="w-12 h-12 text-blue-200" />
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Total Visits</p>
                  <p className="text-3xl font-bold mt-2">
                    {loading ? '...' : formatCount(stats.visits)}
                  </p>
                </div>
                <Activity className="w-12 h-12 text-green-200" />
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100">Total Invoices</p>
                  <p className="text-3xl font-bold mt-2">
                    {loading ? '...' : formatCount(stats.invoices)}
                  </p>
                </div>
                <FileText className="w-12 h-12 text-purple-200" />
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100">Payment Records</p>
                  <p className="text-3xl font-bold mt-2">
                    {loading ? '...' : formatCount(stats.paymentRecords)}
                  </p>
                </div>
                <CreditCard className="w-12 h-12 text-orange-200" />
              </div>
            </div>
          </Card>
        </div>

        {/* Simple Explanation */}
        <Card className="mb-8 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-700">
          <div className="p-6">
            <div className="flex items-start space-x-3">
              <Info className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  How Billing Works (Simple Version)
                </h3>
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                  <strong>1. Patient arrives</strong> → <strong>2. Doctor provides services</strong> → 
                  <strong> 3. System creates invoice</strong> → <strong>4. Patient pays</strong>
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Click on any box below to see detailed information about each step. The numbers in parentheses
                  show how many records exist in each database table (a dash means the count could not be loaded).
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Interactive Workflow Tree */}
        <div className="space-y-4">
          {workflowTree.map(node => renderWorkflowNode(node))}
        </div>

        {/* Relationship Diagram */}
        <Card className="mt-8">
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Database Relationships
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-lg font-medium">
                    patients
                  </div>
                  <ArrowRight className="text-gray-400" />
                  <div className="px-4 py-2 bg-green-100 dark:bg-green-900 rounded-lg font-medium">
                    visits
                  </div>
                  <ArrowRight className="text-gray-400" />
                  <div className="px-4 py-2 bg-purple-100 dark:bg-purple-900 rounded-lg font-medium">
                    invoices
                  </div>
                  <ArrowRight className="text-gray-400" />
                  <div className="px-4 py-2 bg-orange-100 dark:bg-orange-900 rounded-lg font-medium">
                    payments
                  </div>
                </div>
                
                <div className="ml-32 flex items-center space-x-4">
                  <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                    visit_services
                  </div>
                  <span className="text-gray-400">↗</span>
                  <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                    invoice_items
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                  Each arrow represents a foreign key relationship. For example, every visit must belong to a patient,
                  and every invoice must be linked to a visit.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Reference for Developers */}
        <Card className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Developer Quick Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Files</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">src/services/invoiceService.ts</code> - Core billing logic</li>
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">src/components/billing/ServiceSelector.tsx</code> - Service selection UI</li>
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">src/components/forms/AddVisitForm.tsx</code> - Visit with billing</li>
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">src/pages/Finance.tsx</code> - Billing dashboard</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Functions</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">generateInvoiceFromVisit()</code> - Creates invoice</li>
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">calculateBilling()</code> - Medical aid calculations</li>
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">recordPayment()</code> - Process payments</li>
                  <li>• <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">submitMedicalAidClaim()</code> - Submit claims</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}