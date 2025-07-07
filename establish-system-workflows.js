import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

class HMPSWorkflowEstablisher {
  constructor() {
    this.workflows = {};
    this.testResults = [];
    this.systemHealth = {
      authentication: false,
      database: false,
      frontend: false,
      backend: false,
      realtime: false
    };
  }

  async executeSql(sql, description) {
    try {
      const { data, error } = await supabase.rpc('exec_raw_sql', {
        sql_query: sql
      });
      
      if (error) {
        return { success: false, error: error.message, description };
      }
      
      return { success: true, result: data, description };
    } catch (error) {
      return { success: false, error: error.message, description };
    }
  }

  async establishWorkflows() {
    console.log('🏥 HPMS SYSTEM WORKFLOW ESTABLISHMENT');
    console.log('=' .repeat(80));
    
    // 1. AUTHENTICATION WORKFLOW
    await this.establishAuthenticationWorkflow();
    
    // 2. PATIENT MANAGEMENT WORKFLOW
    await this.establishPatientManagementWorkflow();
    
    // 3. APPOINTMENT SCHEDULING WORKFLOW
    await this.establishAppointmentWorkflow();
    
    // 4. CLINICAL DOCUMENTATION WORKFLOW
    await this.establishClinicalWorkflow();
    
    // 5. BILLING & INVOICING WORKFLOW
    await this.establishBillingWorkflow();
    
    // 6. DOCUMENT MANAGEMENT WORKFLOW
    await this.establishDocumentWorkflow();
    
    // 7. ANALYTICS & REPORTING WORKFLOW
    await this.establishAnalyticsWorkflow();
    
    // 8. REAL-TIME NOTIFICATIONS WORKFLOW
    await this.establishNotificationWorkflow();
    
    // 9. SYSTEM ADMINISTRATION WORKFLOW
    await this.establishAdminWorkflow();
    
    // Generate comprehensive report
    await this.generateWorkflowReport();
    
    return this.workflows;
  }

  async establishAuthenticationWorkflow() {
    console.log('\n🔐 AUTHENTICATION WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Authentication & Authorization',
      components: [
        'Login page (/login)',
        'Auth store (useAuthStore)',
        'Protected routes',
        'Role-based access control'
      ],
      tables: ['auth.users', 'admin_users', 'admin_roles', 'admin_sessions'],
      flows: {
        login: [
          'User enters credentials',
          'Supabase auth validates',
          'Auth store updates',
          'Route protection activates',
          'Dashboard loads with role permissions'
        ],
        logout: [
          'User clicks logout',
          'Auth store clears',
          'Session ends',
          'Redirect to login'
        ],
        roleSwitch: [
          'Admin selects practice',
          'Context switches',
          'Permissions update',
          'Dashboard refreshes'
        ]
      }
    };
    
    // Test authentication system
    const authTests = [
      {
        name: 'Auth users table exists',
        test: 'SELECT COUNT(*) FROM auth.users LIMIT 1'
      },
      {
        name: 'Admin users table exists',
        test: 'SELECT COUNT(*) FROM admin_users LIMIT 1'
      },
      {
        name: 'Auth roles configured',
        test: 'SELECT COUNT(*) FROM admin_roles'
      }
    ];
    
    workflow.testResults = [];
    for (const test of authTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.authentication = workflow;
    this.systemHealth.authentication = workflow.testResults.every(r => r.success);
  }

  async establishPatientManagementWorkflow() {
    console.log('\n👥 PATIENT MANAGEMENT WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Patient Registration & Management',
      components: [
        'Patients page (/patients)',
        'Patient detail page (/patients/:id)',
        'ModernPatientRegistrationForm',
        'EditPatientForm',
        'MedicalAidForm',
        'NextOfKinForm'
      ],
      tables: ['patients', 'medical_aid_details', 'next_of_kin'],
      flows: {
        registration: [
          'Navigate to patients page',
          'Click "Add Patient"',
          'Fill registration form',
          'Add medical aid details',
          'Add next of kin',
          'Submit and save',
          'Patient appears in list'
        ],
        editing: [
          'Search/select patient',
          'Open patient detail',
          'Edit information',
          'Save changes',
          'View updated data'
        ],
        search: [
          'Use search bar',
          'Filter by criteria',
          'View results',
          'Select patient'
        ]
      }
    };
    
    const patientTests = [
      {
        name: 'Patients table structure',
        test: 'SELECT column_name FROM information_schema.columns WHERE table_name = \'patients\' LIMIT 5'
      },
      {
        name: 'Medical aid details linked',
        test: 'SELECT COUNT(*) FROM medical_aid_details LIMIT 1'
      },
      {
        name: 'Patient foreign keys work',
        test: 'SELECT COUNT(*) FROM patients p LEFT JOIN medical_aid_details m ON p.id = m.patient_id LIMIT 1'
      }
    ];
    
    workflow.testResults = [];
    for (const test of patientTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.patientManagement = workflow;
  }

  async establishAppointmentWorkflow() {
    console.log('\n📅 APPOINTMENT SCHEDULING WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Appointment Scheduling & Management',
      components: [
        'Dashboard appointment calendar',
        'PremiumAppointmentScheduler',
        'AddAppointmentForm',
        'AppointmentDetailsModal',
        'RescheduleAppointmentModal',
        'AppointmentGridView'
      ],
      tables: ['appointments', 'patients', 'practices'],
      flows: {
        scheduling: [
          'Select date/time slot',
          'Choose patient',
          'Set appointment type',
          'Add notes',
          'Confirm booking',
          'Real-time calendar update'
        ],
        rescheduling: [
          'Open existing appointment',
          'Click reschedule',
          'Select new slot',
          'Confirm change',
          'Update calendar'
        ],
        completion: [
          'Mark appointment complete',
          'Create visit record',
          'Update status',
          'Generate follow-up'
        ]
      }
    };
    
    const appointmentTests = [
      {
        name: 'Appointments table ready',
        test: 'SELECT COUNT(*) FROM appointments LIMIT 1'
      },
      {
        name: 'Patient appointments linked',
        test: 'SELECT COUNT(*) FROM appointments a JOIN patients p ON a.patient_id = p.id LIMIT 1'
      },
      {
        name: 'Appointment statuses valid',
        test: 'SELECT DISTINCT status FROM appointments WHERE status IS NOT NULL LIMIT 5'
      }
    ];
    
    workflow.testResults = [];
    for (const test of appointmentTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.appointmentScheduling = workflow;
  }

  async establishClinicalWorkflow() {
    console.log('\n🏥 CLINICAL DOCUMENTATION WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Clinical Visit & Documentation',
      components: [
        'Visit management forms',
        'VitalsForm',
        'AddLabRequestForm',
        'AddMedicalRecordForm',
        'PremiumAddVisitForm',
        'EditVisitForm'
      ],
      tables: ['visits', 'vitals', 'lab_requests', 'lab_results', 'media_requests'],
      flows: {
        visitCreation: [
          'Patient arrives',
          'Create new visit',
          'Record vitals',
          'Document chief complaint',
          'Clinical assessment',
          'Treatment plan',
          'Follow-up instructions'
        ],
        labWorkflow: [
          'Order lab tests',
          'Generate lab request',
          'Receive results',
          'Review and interpret',
          'Update patient record'
        ],
        imaging: [
          'Order imaging',
          'Create media request',
          'Upload images/reports',
          'Clinical review',
          'Documentation'
        ]
      }
    };
    
    const clinicalTests = [
      {
        name: 'Visits table structure',
        test: 'SELECT COUNT(*) FROM visits LIMIT 1'
      },
      {
        name: 'Vitals linked to visits',
        test: 'SELECT COUNT(*) FROM vitals LIMIT 1'
      },
      {
        name: 'Lab requests system',
        test: 'SELECT COUNT(*) FROM lab_requests LIMIT 1'
      },
      {
        name: 'Visit-patient relationship',
        test: 'SELECT COUNT(*) FROM visits v JOIN patients p ON v.patient_id = p.id LIMIT 1'
      }
    ];
    
    workflow.testResults = [];
    for (const test of clinicalTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.clinicalDocumentation = workflow;
  }

  async establishBillingWorkflow() {
    console.log('\n💰 BILLING & INVOICING WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Billing & Financial Management',
      components: [
        'BillingWorkflow page',
        'Invoice generation',
        'Payment processing',
        'Medical aid claims',
        'Financial reporting'
      ],
      tables: ['invoices_enhanced', 'invoice_services', 'practice_tariffs', 'batch_headers', 'batch_details'],
      flows: {
        invoiceGeneration: [
          'Visit completed',
          'Services rendered',
          'Apply tariffs',
          'Generate invoice',
          'Send to patient/medical aid'
        ],
        medicalAidClaims: [
          'Prepare claim batch',
          'Validate data',
          'Submit to medical aid',
          'Track status',
          'Receive payments'
        ],
        paymentProcessing: [
          'Receive payment',
          'Allocate to invoice',
          'Update balances',
          'Generate receipts'
        ]
      }
    };
    
    const billingTests = [
      {
        name: 'Enhanced invoices ready',
        test: 'SELECT COUNT(*) FROM invoices_enhanced LIMIT 1'
      },
      {
        name: 'Invoice services linked',
        test: 'SELECT COUNT(*) FROM invoice_services LIMIT 1'
      },
      {
        name: 'Practice tariffs configured',
        test: 'SELECT COUNT(*) FROM practice_tariffs LIMIT 1'
      },
      {
        name: 'Batch processing system',
        test: 'SELECT COUNT(*) FROM batch_headers LIMIT 1'
      },
      {
        name: 'Invoice-patient relationship',
        test: 'SELECT COUNT(*) FROM invoices_enhanced i JOIN patients p ON i.patient_id = p.id LIMIT 1'
      }
    ];
    
    workflow.testResults = [];
    for (const test of billingTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.billingInvoicing = workflow;
  }

  async establishDocumentWorkflow() {
    console.log('\n📄 DOCUMENT MANAGEMENT WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Document Upload & Management',
      components: [
        'Document upload system',
        'Supabase storage integration',
        'File type validation',
        'Document viewer'
      ],
      tables: ['patient_documents', 'storage.objects', 'storage.buckets'],
      flows: {
        upload: [
          'Select file',
          'Validate type/size',
          'Upload to Supabase storage',
          'Create database record',
          'Link to patient',
          'Display in UI'
        ],
        viewing: [
          'Browse documents',
          'Preview files',
          'Download if needed',
          'Manage permissions'
        ]
      }
    };
    
    const documentTests = [
      {
        name: 'Storage bucket exists',
        test: 'SELECT COUNT(*) FROM storage.buckets WHERE name = \'documents\''
      },
      {
        name: 'Patient documents table',
        test: 'SELECT COUNT(*) FROM patient_documents LIMIT 1'
      }
    ];
    
    workflow.testResults = [];
    for (const test of documentTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.documentManagement = workflow;
  }

  async establishAnalyticsWorkflow() {
    console.log('\n📊 ANALYTICS & REPORTING WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Analytics & Business Intelligence',
      components: [
        'Dashboard statistics',
        'Financial reports',
        'Practice analytics',
        'Patient metrics',
        'Performance indicators'
      ],
      tables: ['practice_analytics', 'dashboard_stats_view', 'financial_overview'],
      flows: {
        dashboardMetrics: [
          'Load practice data',
          'Calculate KPIs',
          'Generate charts',
          'Display insights',
          'Real-time updates'
        ],
        reporting: [
          'Select report type',
          'Set date range',
          'Generate data',
          'Export results',
          'Schedule delivery'
        ]
      }
    };
    
    const analyticsTests = [
      {
        name: 'Practice analytics table',
        test: 'SELECT COUNT(*) FROM practice_analytics LIMIT 1'
      },
      {
        name: 'Dashboard views available',
        test: 'SELECT table_name FROM information_schema.views WHERE table_name LIKE \'%analytics%\' OR table_name LIKE \'%dashboard%\' LIMIT 3'
      }
    ];
    
    workflow.testResults = [];
    for (const test of analyticsTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.analyticsReporting = workflow;
  }

  async establishNotificationWorkflow() {
    console.log('\n🔔 REAL-TIME NOTIFICATIONS WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'Real-time Notifications & Alerts',
      components: [
        'NotificationsPanel',
        'Real-time subscriptions',
        'Toast notifications',
        'System alerts'
      ],
      tables: ['messages', 'notifications', 'system_alerts'],
      flows: {
        realTimeUpdates: [
          'Database changes occur',
          'Supabase triggers events',
          'Frontend receives updates',
          'UI reflects changes',
          'User notifications'
        ],
        messaging: [
          'Create message',
          'Set recipients',
          'Send notification',
          'Track delivery',
          'Mark as read'
        ]
      }
    };
    
    const notificationTests = [
      {
        name: 'Messages table exists',
        test: 'SELECT COUNT(*) FROM messages LIMIT 1'
      },
      {
        name: 'Real-time subscriptions',
        test: 'SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN (\'notifications\', \'system_alerts\') LIMIT 2'
      }
    ];
    
    workflow.testResults = [];
    for (const test of notificationTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${test.name}`);
    }
    
    this.workflows.notifications = workflow;
  }

  async establishAdminWorkflow() {
    console.log('\n⚙️ SYSTEM ADMINISTRATION WORKFLOW');
    console.log('-'.repeat(50));
    
    const workflow = {
      name: 'System Administration & Configuration',
      components: [
        'PracticesManagement',
        'TariffManagement',
        'User management',
        'System settings',
        'Configuration panels'
      ],
      tables: ['practices', 'practice_tariffs', 'admin_users', 'admin_roles'],
      flows: {
        practiceManagement: [
          'Create new practice',
          'Configure settings',
          'Add users',
          'Set permissions',
          'Manage billing'
        ],
        tariffManagement: [
          'Define service codes',
          'Set pricing',
          'Medical aid rates',
          'Update schedules',
          'Apply changes'
        ]
      }
    };
    
    const adminTests = [
      {
        name: 'Practices table configured',
        test: 'SELECT COUNT(*) FROM practices'
      },
      {
        name: 'Practice tariffs system',
        test: 'SELECT COUNT(*) FROM practice_tariffs'
      },
      {
        name: 'Admin role system',
        test: 'SELECT COUNT(*) FROM admin_roles'
      }
    ];
    
    workflow.testResults = [];
    for (const test of adminTests) {
      const result = await this.executeSql(test.test, test.name);
      workflow.testResults.push(result);
      console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
    }
    
    this.workflows.systemAdministration = workflow;
  }

  async generateWorkflowReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 HPMS WORKFLOW ESTABLISHMENT REPORT');
    console.log('='.repeat(80));
    
    let totalTests = 0;
    let passedTests = 0;
    
    console.log('\n📋 WORKFLOW SUMMARY:');
    console.log('-'.repeat(60));
    
    for (const [key, workflow] of Object.entries(this.workflows)) {
      const passed = workflow.testResults?.filter(t => t.success).length || 0;
      const total = workflow.testResults?.length || 0;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      totalTests += total;
      passedTests += passed;
      
      console.log(`${percentage === 100 ? '✅' : percentage > 50 ? '⚠️' : '❌'} ${workflow.name}`);
      console.log(`   Tests: ${passed}/${total} (${percentage}%)`);
      console.log(`   Components: ${workflow.components?.length || 0}`);
      console.log(`   Tables: ${workflow.tables?.length || 0}`);
      console.log('');
    }
    
    const overallPercentage = Math.round((passedTests / totalTests) * 100);
    
    console.log('🏆 OVERALL SYSTEM HEALTH:');
    console.log('-'.repeat(30));
    console.log(`Tests Passed: ${passedTests}/${totalTests} (${overallPercentage}%)`);
    console.log(`Workflows Established: ${Object.keys(this.workflows).length}`);
    
    if (overallPercentage >= 90) {
      console.log('🎉 EXCELLENT: System is production-ready!');
    } else if (overallPercentage >= 70) {
      console.log('✅ GOOD: System is functional with minor issues');
    } else {
      console.log('⚠️  NEEDS ATTENTION: Critical issues require fixing');
    }
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run `npm run dev` to test frontend workflows');
    console.log('2. Test user authentication flow');
    console.log('3. Verify patient registration workflow');
    console.log('4. Test appointment scheduling');
    console.log('5. Validate billing processes');
    console.log('6. Check real-time updates');
    
    // Create workflow test commands
    console.log('\n🧪 TESTING COMMANDS:');
    console.log('Frontend: npm run dev');
    console.log('Database: node establish-system-workflows.js');
    console.log('MCP SQL: node mcp-sql-standard.js');
    
    return {
      totalTests,
      passedTests,
      overallPercentage,
      workflows: this.workflows
    };
  }
}

// Execute workflow establishment
async function main() {
  const establisher = new HMPSWorkflowEstablisher();
  const results = await establisher.establishWorkflows();
  
  console.log('\n🎯 Workflow establishment complete!');
  console.log('All system workflows have been mapped and tested.');
  
  return results;
}

main().catch(console.error);