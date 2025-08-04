#!/usr/bin/env node

/**
 * HPMS Domain Knowledge and Patterns
 * 
 * Contains all healthcare-specific patterns, workflows, and intelligence
 * for the OneHealth Practice Management System
 */

export const HPMS_PATTERNS = {
  
  /**
   * Core Database Tables and Their Importance
   */
  CORE_TABLES: {
    visits: {
      importance: 'PRIMARY',
      description: 'Central table for appointments and visits',
      criticalFields: ['visit_date', 'visit_time', 'is_scheduled', 'status'],
      commonErrors: [
        'Using scheduled_date instead of visit_date',
        'Missing is_scheduled=true for appointments',
        'Incorrect status transitions'
      ],
      triggers: ['appointment_automation_trigger', 'generate_visit_number'],
      relationships: ['patients', 'users', 'practices', 'medical_records', 'invoices_enhanced']
    },
    
    patients: {
      importance: 'CRITICAL',
      description: 'Core patient records with auto-generated reference numbers',
      criticalFields: ['system_patient_reference_number', 'practice_id'],
      commonErrors: [
        'Cross-practice data access',
        'Missing practice_id validation',
        'Hardcoded practice IDs'
      ],
      triggers: ['assign_system_patient_reference_number_trigger'],
      securityRules: 'STRICT practice-based RLS policies'
    },
    
    practice_sms_logs: {
      importance: 'SECURITY_CRITICAL',
      description: 'SMS tracking with full audit trail',
      mustUseGateway: 'centralized-sms-gateway',
      antiPattern: 'Direct SMS sending',
      complianceRequired: true
    },
    
    practice_email_logs: {
      importance: 'SECURITY_CRITICAL', 
      description: 'Email tracking with full audit trail',
      mustUseGateway: 'centralized-email-gateway',
      antiPattern: 'Direct email sending',
      complianceRequired: true
    }
  },

  /**
   * Critical Medical Workflows
   */
  MEDICAL_WORKFLOWS: {
    patientRegistration: {
      flow: ['ModernPatientRegistrationForm', 'patients table', 'assign_system_patient_reference_number_trigger'],
      validation: ['ID number format', 'practice_id assignment', 'medical aid details'],
      security: ['practice isolation', 'audit logging']
    },
    
    appointmentScheduling: {
      flow: ['PremiumAppointmentScheduler', 'visits table', 'appointment_automation_trigger'],
      criticalFields: ['visit_date (NOT scheduled_date)', 'is_scheduled=true', 'status=scheduled'],
      automation: ['SMS reminder', 'email confirmation'],
      commonMistakes: [
        'Using wrong date fields',
        'Missing automation triggers',
        'Incorrect status values'
      ]
    },
    
    visitRecording: {
      flow: ['PremiumAddVisitForm', 'visits update', 'vitals', 'medical_records'],
      statusTransitions: ['scheduled → ready → in_progress → completed'],
      requiredData: ['chief_complaint', 'diagnosis', 'treatment_plan'],
      billing: 'Links to invoice generation'
    },
    
    communicationGateway: {
      smsFlow: ['centralized-sms-gateway', 'practice_sms_logs', 'delivery tracking'],
      emailFlow: ['centralized-email-gateway', 'practice_email_logs', 'delivery tracking'],
      security: 'NEVER direct API calls from frontend',
      compliance: 'Full audit trails required'
    }
  },

  /**
   * Security Patterns (Critical for Healthcare)
   */
  SECURITY_PATTERNS: {
    practiceIsolation: {
      rule: 'ALL data must be filtered by practice_id',
      antiPatterns: [
        'practice_id || "default-id"',
        'localStorage.getItem("practiceId")',
        'Hardcoded practice IDs'
      ],
      correct: 'getSafePracticeId(user) with validation',
      rls: 'Row Level Security policies enforce isolation'
    },
    
    patientDataAccess: {
      rule: 'Always validate practice context before patient data access',
      validation: 'practiceValidation.ts utility functions',
      logging: 'All patient access logged in audit_logs',
      encryption: 'Sensitive data encrypted at rest'
    },
    
    communicationSecurity: {
      rule: 'ALL SMS/Email must go through centralized gateways',
      logging: 'Complete audit trail in practice_*_logs tables',
      credentials: 'Never expose API keys to frontend',
      tracking: 'Full delivery and cost tracking'
    }
  },

  /**
   * Performance Patterns
   */
  PERFORMANCE_PATTERNS: {
    databaseQueries: {
      visitsByDate: 'Use idx_visits_scheduled_date index',
      patientSearch: 'Use idx_patients_id_number for ID searches',
      appointmentCalendar: 'Pre-load today\'s appointments',
      medicalRecords: 'Paginate with cursor-based pagination'
    },
    
    reactOptimization: {
      appointmentScheduler: 'Use React.memo() for calendar components',
      patientList: 'Virtualize large patient lists',
      medicalForms: 'Debounce form inputs (300ms)',
      realTimeUpdates: 'Throttle subscription updates'
    },
    
    caching: {
      patientData: 'React Query with 5-minute staleTime',
      appointments: 'Cache today\'s appointments in memory',
      practiceSettings: 'Cache with 24-hour expiry',
      medicalTemplates: 'Infinite staleTime for templates'
    }
  },

  /**
   * Common React Error Patterns in HPMS
   */
  REACT_ERROR_PATTERNS: {
    visitComponents: {
      missingKeys: 'visit.map() without key prop',
      hookDependencies: 'useEffect missing dependencies for visit data',
      stateUpdates: 'Direct state mutation in appointment forms',
      errorBoundaries: 'Missing error boundaries in medical forms'
    },
    
    appointmentScheduler: {
      dateHandling: 'Incorrect date comparisons',
      timeZones: 'Missing timezone handling',
      calendarState: 'Complex calendar state management',
      conflictDetection: 'Race conditions in appointment booking'
    },
    
    patientForms: {
      validation: 'Missing form validation',
      submission: 'Multiple form submissions',
      fileUploads: 'Unhandled file upload errors',
      medicalData: 'Unvalidated medical data input'
    }
  },

  /**
   * UI/UX Patterns for Healthcare
   */
  UI_PATTERNS: {
    icons: {
      library: 'Solar Bold Duotone',
      source: '@iconify/react',
      style: 'Bold Duotone variants only',
      healthcare: ['health-bold-duotone', 'medical-kit-bold-duotone', 'user-heart-bold-duotone']
    },
    
    forms: {
      medical: 'Multi-step forms with progress indicators',
      validation: 'Real-time validation with medical context',
      accessibility: 'Full keyboard navigation for clinical use',
      mobile: 'Touch-friendly for tablet use'
    },
    
    colors: {
      theme: 'Healthcare-appropriate color scheme',
      alerts: 'Medical emergency red, warning orange',
      status: 'Color-coded appointment status',
      accessibility: 'WCAG compliance for clinical environments'
    }
  },

  /**
   * Component Architecture Patterns
   */
  COMPONENT_PATTERNS: {
    premium: {
      naming: 'Premium* for main components',
      examples: ['PremiumAppointmentScheduler', 'PremiumAddVisitForm'],
      features: 'Full-featured with validation and error handling'
    },
    
    modern: {
      naming: 'Modern* for updated versions',
      examples: ['ModernPatientRegistrationForm'],
      replacement: 'Replaces older Basic* components'
    },
    
    medical: {
      prefix: 'Medical*, Patient*, Visit*',
      context: 'Healthcare domain-specific',
      validation: 'Medical data validation built-in'
    }
  },

  /**
   * Edge Function Patterns
   */
  EDGE_FUNCTION_PATTERNS: {
    communication: {
      sms: 'centralized-sms-gateway (SMSPortal integration)',
      email: 'centralized-email-gateway (Resend integration)',
      automation: 'process-automation-queue (processes automations)',
      security: 'Never call external APIs directly from frontend'
    },
    
    authentication: {
      required: 'All edge functions require valid JWT',
      validation: 'Practice context validation required',
      errorHandling: 'Structured error responses',
      logging: 'Full request/response logging'
    }
  },

  /**
   * Common Anti-Patterns (Things to Avoid)
   */
  ANTI_PATTERNS: {
    security: [
      'Hardcoded practice IDs as fallbacks',
      'localStorage for practice context',
      'Direct API calls for SMS/Email',
      'Missing practice_id validation',
      'Cross-practice data queries'
    ],
    
    performance: [
      'SELECT * FROM large tables',
      'Unoptimized .map() in render',
      'Missing React.memo() on expensive components',
      'Synchronous operations in useEffect',
      'No debouncing on search inputs'
    ],
    
    medical: [
      'Using scheduled_date instead of visit_date',
      'Missing medical data validation',
      'Incomplete audit trails',
      'Missing error boundaries in clinical forms',
      'Unencrypted patient data transmission'
    ]
  },

  /**
   * Testing Patterns for Healthcare
   */
  TESTING_PATTERNS: {
    medical: {
      patientData: 'Test with synthetic patient data only',
      workflows: 'Test complete medical workflows end-to-end',
      security: 'Test practice isolation thoroughly',
      compliance: 'Validate audit trail completeness'
    },
    
    integration: {
      smsGateway: 'Mock SMS gateway responses',
      emailGateway: 'Test email template rendering',
      database: 'Test with realistic medical data volumes',
      realtime: 'Test subscription updates under load'
    }
  }
};

/**
 * Pattern Detection Functions
 */
export const PatternDetectors = {
  /**
   * Detect critical security violations
   */
  detectSecurityViolations(code) {
    const violations = [];
    
    // Cross-practice access
    if (code.match(/practice_id\s*\|\|\s*['"][^'"]*['"]/)) {
      violations.push({
        type: 'CRITICAL_SECURITY',
        pattern: 'Cross-practice access via fallback ID',
        severity: 'critical',
        fix: 'Use getSafePracticeId(user) with proper validation'
      });
    }
    
    // Direct SMS/Email API usage
    if (code.match(/smsportal|resend/i) && !code.includes('gateway')) {
      violations.push({
        type: 'CRITICAL_SECURITY', 
        pattern: 'Direct API usage bypassing gateways',
        severity: 'critical',
        fix: 'Use centralized-sms-gateway or centralized-email-gateway'
      });
    }
    
    return violations;
  },

  /**
   * Detect medical workflow violations
   */
  detectMedicalWorkflowViolations(code) {
    const violations = [];
    
    // Wrong date field usage
    if (code.includes('scheduled_date') && code.includes('visits')) {
      violations.push({
        type: 'MEDICAL_WORKFLOW',
        pattern: 'Using scheduled_date instead of visit_date',
        severity: 'high',
        fix: 'Use visit_date and visit_time for appointments'
      });
    }
    
    // Missing automation trigger
    if (code.includes('is_scheduled') && !code.includes('automation')) {
      violations.push({
        type: 'MEDICAL_WORKFLOW',
        pattern: 'Appointment without automation',
        severity: 'medium',
        fix: 'Ensure appointment_automation_trigger is working'
      });
    }
    
    return violations;
  },

  /**
   * Detect performance issues
   */
  detectPerformanceIssues(code) {
    const issues = [];
    
    // Unoptimized maps
    if (code.match(/\.map\(/g) && !code.includes('memo')) {
      issues.push({
        type: 'PERFORMANCE',
        pattern: 'Unoptimized list rendering',
        severity: 'medium',
        fix: 'Wrap component in React.memo() and use useMemo() for expensive calculations'
      });
    }
    
    // Missing debouncing
    if (code.includes('onChange') && code.includes('search') && !code.includes('debounce')) {
      issues.push({
        type: 'PERFORMANCE',
        pattern: 'Search without debouncing',
        severity: 'medium',
        fix: 'Add debouncing with 300ms delay'
      });
    }
    
    return issues;
  }
};

export default HPMS_PATTERNS;