#!/usr/bin/env node

/**
 * Business Logic Validator Agent
 * 
 * MISSION: Validate healthcare business logic, workflow integrity, and medical process compliance
 * FOCUS: Patient registration → appointment → visit → billing flows
 * TARGET: Ensure business rules are properly implemented and medical workflows follow standards
 */

import { IntelligentAgent } from '../shared/agent-base.js';
import { HpmsPatterns } from '../shared/hpms-patterns.js';

export class BusinessLogicValidatorAgent extends IntelligentAgent {
  constructor() {
    super({
      id: 'business-logic-validator',
      name: '💼 Business Logic Validator Agent',
      hpmsContext: {
        workflows: {
          patientJourney: [
            'registration',
            'appointment_scheduling',
            'check_in',
            'consultation',
            'diagnostics',
            'treatment',
            'billing',
            'follow_up'
          ],
          billingFlow: [
            'service_delivery',
            'charge_capture',
            'claim_creation',
            'insurance_verification',
            'claim_submission',
            'payment_posting',
            'patient_billing'
          ],
          hrWorkflow: [
            'employee_onboarding',
            'timesheet_submission',
            'leave_request',
            'approval_process',
            'payroll_processing'
          ]
        },
        businessRules: {
          appointments: [
            'Cannot schedule in the past',
            'Doctor availability must be checked',
            'Patient must exist before appointment',
            'Appointment conflicts must be prevented',
            'Cancellation requires reason and audit'
          ],
          billing: [
            'Services must be linked to visits',
            'Insurance must be verified before billing',
            'Co-payments collected at service time',
            'Claims submitted within 30 days',
            'Refunds require approval and audit'
          ],
          medical: [
            'Vitals required for consultation visits',
            'Prescriptions need valid diagnosis',
            'Lab results require provider review',
            'Referrals need authorization',
            'Discharge requires summary'
          ]
        }
      }
    });
    
    this.validationPatterns = {
      // Workflow violations
      workflowBreaks: {
        appointmentWithoutPatient: /visits.*insert(?!.*patient_id)/,
        billingWithoutVisit: /invoices.*insert(?!.*visit_id)/,
        prescriptionWithoutDiagnosis: /prescriptions.*insert(?!.*diagnosis)/,
        visitWithoutPractice: /visits.*insert(?!.*practice_id)/
      },
      
      // Business rule violations
      ruleViolations: {
        pastDateScheduling: /visit_date.*<.*new Date\(\)/,
        missingAuditTrail: /(delete|update)(?!.*audit)/i,
        hardcodedPrices: /amount.*=.*\d+/,
        missingValidation: /insert\((?!.*validate)/,
        directStatusChange: /status.*=.*['"]completed['"]/
      },
      
      // HPMS-specific violations
      hpmsViolations: {
        wrongDateField: /scheduled_date/,
        missingPracticeIsolation: /from\(['"](?!.*practice_id)/,
        crossPracticeAccess: /practice_id.*!=/,
        missingUserTracking: /insert\((?!.*created_by)/
      }
    };
    
    this.workflowStates = {
      visits: {
        validTransitions: {
          'scheduled': ['confirmed', 'cancelled', 'rescheduled'],
          'confirmed': ['checked_in', 'cancelled', 'no_show'],
          'checked_in': ['in_progress', 'cancelled'],
          'in_progress': ['completed', 'cancelled'],
          'completed': ['billed', 'follow_up_scheduled'],
          'cancelled': [],
          'no_show': ['rescheduled']
        }
      },
      invoices: {
        validTransitions: {
          'draft': ['pending', 'cancelled'],
          'pending': ['partial', 'paid', 'overdue', 'cancelled'],
          'partial': ['paid', 'overdue', 'cancelled'],
          'paid': ['refunded'],
          'overdue': ['paid', 'written_off'],
          'cancelled': [],
          'refunded': []
        }
      }
    };
  }
  
  async validateBusinessLogic(content, filename) {
    const violations = [];
    const warnings = [];
    const suggestions = [];
    
    // Check workflow integrity
    const workflowIssues = this.checkWorkflowIntegrity(content, filename);
    violations.push(...workflowIssues.violations);
    warnings.push(...workflowIssues.warnings);
    
    // Validate business rules
    const ruleIssues = this.validateBusinessRules(content, filename);
    violations.push(...ruleIssues.violations);
    suggestions.push(...ruleIssues.suggestions);
    
    // Check state transitions
    const stateIssues = this.validateStateTransitions(content);
    violations.push(...stateIssues.violations);
    
    // HPMS-specific validations
    const hpmsIssues = this.validateHPMSPatterns(content, filename);
    violations.push(...hpmsIssues.violations);
    warnings.push(...hpmsIssues.warnings);
    
    // Generate workflow recommendations
    const recommendations = this.generateWorkflowRecommendations(
      violations,
      warnings,
      filename
    );
    
    return {
      violations,
      warnings,
      suggestions,
      recommendations,
      severity: this.calculateSeverity(violations, warnings)
    };
  }
  
  checkWorkflowIntegrity(content, filename) {
    const violations = [];
    const warnings = [];
    
    // Check for workflow breaks
    Object.entries(this.validationPatterns.workflowBreaks).forEach(([type, pattern]) => {
      if (pattern.test(content)) {
        violations.push({
          type: 'workflow-break',
          rule: type,
          message: this.getWorkflowViolationMessage(type),
          severity: 'critical'
        });
      }
    });
    
    // Check for appointment workflow
    if (content.includes('visits') && content.includes('insert')) {
      if (!content.includes('checkDoctorAvailability')) {
        warnings.push({
          type: 'workflow-incomplete',
          message: 'Appointment creation should check doctor availability',
          suggestion: 'Add availability check before creating appointment'
        });
      }
      
      if (!content.includes('sendConfirmation') && !content.includes('communicationService')) {
        warnings.push({
          type: 'workflow-incomplete', 
          message: 'Appointment creation should send confirmation',
          suggestion: 'Use communicationService to send SMS/Email confirmation'
        });
      }
    }
    
    // Check billing workflow
    if (content.includes('invoices') && content.includes('insert')) {
      if (!content.includes('calculateTaxes')) {
        violations.push({
          type: 'billing-violation',
          message: 'Invoice creation must calculate taxes',
          severity: 'high'
        });
      }
      
      if (!content.includes('insurance_verification')) {
        warnings.push({
          type: 'billing-warning',
          message: 'Consider insurance verification before billing'
        });
      }
    }
    
    return { violations, warnings };
  }
  
  validateBusinessRules(content, filename) {
    const violations = [];
    const suggestions = [];
    
    // Check each business rule pattern
    Object.entries(this.validationPatterns.ruleViolations).forEach(([rule, pattern]) => {
      if (pattern.test(content)) {
        const violation = {
          type: 'business-rule',
          rule,
          message: this.getBusinessRuleMessage(rule),
          fix: this.getBusinessRuleFix(rule)
        };
        violations.push(violation);
      }
    });
    
    // Medical workflow specific rules
    if (filename.includes('medical') || content.includes('consultation')) {
      if (!content.includes('vitals') && content.includes('consultation')) {
        violations.push({
          type: 'medical-rule',
          message: 'Consultation visits require vital signs',
          fix: 'Add vitals recording before consultation'
        });
      }
      
      if (content.includes('prescription') && !content.includes('diagnosis')) {
        violations.push({
          type: 'medical-rule',
          message: 'Prescriptions require valid diagnosis',
          severity: 'critical',
          fix: 'Link prescription to diagnosis code'
        });
      }
    }
    
    // HR workflow rules
    if (content.includes('timesheet') || content.includes('payroll')) {
      if (!content.includes('approval_status')) {
        violations.push({
          type: 'hr-rule',
          message: 'Timesheets require approval before payroll',
          fix: 'Add approval workflow for timesheets'
        });
      }
    }
    
    // Generate suggestions based on context
    if (content.includes('patient') && !content.includes('consent')) {
      suggestions.push({
        type: 'compliance',
        message: 'Consider adding patient consent tracking',
        importance: 'medium'
      });
    }
    
    return { violations, suggestions };
  }
  
  validateStateTransitions(content) {
    const violations = [];
    
    // Check for valid state transitions
    Object.entries(this.workflowStates).forEach(([entity, states]) => {
      const stateChanges = content.match(
        new RegExp(`${entity}.*status.*['"](\\w+)['"].*['"](\\w+)['"]`, 'g')
      );
      
      if (stateChanges) {
        stateChanges.forEach(change => {
          const matches = change.match(/['"](\w+)['"]/g);
          if (matches && matches.length >= 2) {
            const fromState = matches[0].replace(/['"]/g, '');
            const toState = matches[1].replace(/['"]/g, '');
            
            if (!this.isValidTransition(entity, fromState, toState)) {
              violations.push({
                type: 'state-transition',
                entity,
                message: `Invalid transition: ${fromState} → ${toState}`,
                validTransitions: states.validTransitions[fromState] || [],
                severity: 'high'
              });
            }
          }
        });
      }
    });
    
    // Check for direct status updates without validation
    if (content.match(/UPDATE.*status\s*=\s*['"]completed['"]/i)) {
      violations.push({
        type: 'state-validation',
        message: 'Direct status update to "completed" without validation',
        suggestion: 'Validate required fields before marking as completed',
        severity: 'high'
      });
    }
    
    return { violations };
  }
  
  validateHPMSPatterns(content, filename) {
    const violations = [];
    const warnings = [];
    
    // Check HPMS-specific patterns
    Object.entries(this.validationPatterns.hpmsViolations).forEach(([type, pattern]) => {
      if (pattern.test(content)) {
        violations.push({
          type: 'hpms-violation',
          rule: type,
          message: this.getHPMSViolationMessage(type),
          severity: type === 'crossPracticeAccess' ? 'critical' : 'high',
          fix: this.getHPMSFix(type)
        });
      }
    });
    
    // Check for core medical workflow patterns
    if (content.includes('visits')) {
      // Ensure proper visit workflow
      if (!content.includes('patient_id') && content.includes('insert')) {
        violations.push({
          type: 'hpms-workflow',
          message: 'Visit must be linked to a patient',
          severity: 'critical'
        });
      }
      
      if (content.includes('scheduled_date')) {
        violations.push({
          type: 'hpms-schema',
          message: 'Use visit_date instead of scheduled_date for visits table',
          severity: 'high',
          fix: 'Replace scheduled_date with visit_date'
        });
      }
    }
    
    // Communication validation
    if (content.includes('sendSMS') || content.includes('sendEmail')) {
      if (!content.includes('communicationService')) {
        violations.push({
          type: 'hpms-communication',
          message: 'Must use centralized communication gateway',
          severity: 'critical',
          fix: 'Use communicationService.sendSMS() or sendEmail()'
        });
      }
    }
    
    return { violations, warnings };
  }
  
  isValidTransition(entity, fromState, toState) {
    const transitions = this.workflowStates[entity]?.validTransitions[fromState];
    return transitions && transitions.includes(toState);
  }
  
  calculateSeverity(violations, warnings) {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) return 'critical';
    if (highCount > 2 || violations.length > 5) return 'high';
    if (violations.length > 0 || warnings.length > 3) return 'medium';
    return 'low';
  }
  
  generateWorkflowRecommendations(violations, warnings, filename) {
    const recommendations = [];
    
    // Analyze patterns in violations
    const violationTypes = violations.map(v => v.type);
    
    if (violationTypes.includes('workflow-break')) {
      recommendations.push({
        category: 'Workflow Integrity',
        suggestion: 'Implement proper workflow validation before state changes',
        example: this.getWorkflowExample(filename)
      });
    }
    
    if (violationTypes.includes('state-transition')) {
      recommendations.push({
        category: 'State Management',
        suggestion: 'Use a state machine pattern for complex workflows',
        example: this.getStateMachineExample()
      });
    }
    
    if (violationTypes.includes('hpms-violation')) {
      recommendations.push({
        category: 'HPMS Compliance',
        suggestion: 'Review HPMS patterns and ensure practice isolation',
        example: this.getHPMSComplianceExample()
      });
    }
    
    // Add general recommendations based on file type
    if (filename.includes('service') || filename.includes('api')) {
      recommendations.push({
        category: 'Service Layer',
        suggestion: 'Implement service layer validation for business rules',
        pattern: 'Validate → Process → Audit → Notify'
      });
    }
    
    return recommendations;
  }
  
  getWorkflowViolationMessage(type) {
    const messages = {
      appointmentWithoutPatient: 'Creating appointment without valid patient reference',
      billingWithoutVisit: 'Creating invoice without linking to visit',
      prescriptionWithoutDiagnosis: 'Creating prescription without diagnosis',
      visitWithoutPractice: 'Creating visit without practice isolation'
    };
    return messages[type] || 'Workflow integrity violation';
  }
  
  getBusinessRuleMessage(rule) {
    const messages = {
      pastDateScheduling: 'Attempting to schedule appointment in the past',
      missingAuditTrail: 'Data modification without audit trail',
      hardcodedPrices: 'Using hardcoded prices instead of price list',
      missingValidation: 'Data insertion without validation',
      directStatusChange: 'Direct status change without workflow validation'
    };
    return messages[rule] || 'Business rule violation';
  }
  
  getHPMSViolationMessage(type) {
    const messages = {
      wrongDateField: 'Using incorrect date field for visits table',
      missingPracticeIsolation: 'Query missing practice_id filter',
      crossPracticeAccess: 'Potential cross-practice data access',
      missingUserTracking: 'Data modification without user tracking'
    };
    return messages[type] || 'HPMS pattern violation';
  }
  
  getHPMSFix(type) {
    const fixes = {
      wrongDateField: 'Use visit_date instead of scheduled_date',
      missingPracticeIsolation: 'Add .eq(\'practice_id\', practiceId) to query',
      crossPracticeAccess: 'Ensure practice_id equality check',
      missingUserTracking: 'Add created_by: user.id to insert data'
    };
    return fixes[type] || 'Review HPMS patterns';
  }
  
  getBusinessRuleFix(rule) {
    const fixes = {
      pastDateScheduling: `if (visitDate < new Date()) {
  throw new Error('Cannot schedule appointments in the past');
}`,
      missingAuditTrail: `await logAuditTrail({
  action: 'UPDATE_RECORD',
  resource: 'table_name',
  resourceId: record.id,
  practiceId,
  userId: user.id
});`,
      hardcodedPrices: 'Fetch prices from practice_tariffs or service_prices table',
      missingValidation: 'Add validation schema before insert',
      directStatusChange: 'Use workflow service to validate state transitions'
    };
    return fixes[rule];
  }
  
  getWorkflowExample(filename) {
    return `// Proper appointment workflow
async function createAppointment(data) {
  // 1. Validate patient exists
  const patient = await validatePatient(data.patientId);
  
  // 2. Check doctor availability
  const isAvailable = await checkDoctorAvailability(
    data.doctorId,
    data.visitDate
  );
  
  // 3. Create appointment with audit
  const appointment = await supabase
    .from('visits')
    .insert({
      ...data,
      status: 'scheduled',
      created_by: user.id
    });
    
  // 4. Send confirmation
  await communicationService.sendSMS({
    practiceId: data.practiceId,
    recipientPhone: patient.phone,
    messageContent: 'Appointment confirmed',
    messageType: 'appointment_confirmation'
  });
  
  return appointment;
}`;
  }
  
  getStateMachineExample() {
    return `// State machine for visit workflow
const visitStateMachine = {
  states: {
    scheduled: {
      on: {
        CONFIRM: 'confirmed',
        CANCEL: 'cancelled',
        RESCHEDULE: 'scheduled'
      }
    },
    confirmed: {
      on: {
        CHECK_IN: 'checked_in',
        CANCEL: 'cancelled',
        NO_SHOW: 'no_show'
      }
    },
    checked_in: {
      on: {
        START: 'in_progress',
        CANCEL: 'cancelled'
      }
    },
    in_progress: {
      on: {
        COMPLETE: 'completed'
      }
    },
    completed: {
      on: {
        BILL: 'billed'
      }
    }
  },
  
  transition(currentState, event) {
    const nextState = this.states[currentState]?.on[event];
    if (!nextState) {
      throw new Error(\`Invalid transition: \${currentState} + \${event}\`);
    }
    return nextState;
  }
};`;
  }
  
  getHPMSComplianceExample() {
    return `// HPMS-compliant data access
async function getPatientVisits(patientId, practiceId) {
  // Verify practice access
  if (!verifyPracticeAccess(user, practiceId)) {
    throw new Error('Unauthorized practice access');
  }
  
  // Query with practice isolation
  const { data, error } = await supabase
    .from('visits')
    .select(\`
      *,
      patient:patients!inner(
        full_name,
        system_patient_reference_number
      )
    \`)
    .eq('patient_id', patientId)
    .eq('practice_id', practiceId) // Critical: practice isolation
    .order('visit_date', { ascending: false });
    
  // Audit the access
  await logAuditTrail({
    action: 'VIEW_PATIENT_VISITS',
    resource: 'visits',
    resourceId: patientId,
    practiceId,
    userId: user.id
  });
  
  return data;
}`;
  }
  
  async execute(hookData) {
    const content = hookData.tool_result?.content || '';
    const filename = hookData.tool_input?.file_path || 'unknown';
    
    if (!content || filename === 'unknown') {
      return { action: 'skip', reason: 'No content to validate' };
    }
    
    const validation = await this.validateBusinessLogic(content, filename);
    
    if (validation.violations.length === 0 && validation.warnings.length === 0) {
      return {
        action: 'approve',
        reason: 'Business logic is sound',
        confidence: 'high'
      };
    }
    
    // Critical violations block the operation
    if (validation.severity === 'critical') {
      return {
        action: 'block',
        reason: 'Critical business logic violations detected',
        violations: validation.violations,
        recommendations: validation.recommendations,
        severity: 'critical'
      };
    }
    
    // Generate detailed report
    const report = {
      action: 'review',
      violations: validation.violations,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
      recommendations: validation.recommendations,
      severity: validation.severity,
      summary: this.generateValidationSummary(validation)
    };
    
    // Store validation results
    await this.storeKnowledge(`validation-${filename}`, {
      timestamp: new Date().toISOString(),
      severity: validation.severity,
      violationCount: validation.violations.length,
      warningCount: validation.warnings.length,
      patterns: validation.violations.map(v => v.type)
    });
    
    return report;
  }
  
  generateValidationSummary(validation) {
    const summary = [];
    
    if (validation.violations.length > 0) {
      summary.push(`Found ${validation.violations.length} business logic violations`);
      
      const critical = validation.violations.filter(v => v.severity === 'critical');
      if (critical.length > 0) {
        summary.push(`${critical.length} are CRITICAL and must be fixed`);
      }
    }
    
    if (validation.warnings.length > 0) {
      summary.push(`${validation.warnings.length} warnings for best practices`);
    }
    
    if (validation.suggestions.length > 0) {
      summary.push(`${validation.suggestions.length} improvement suggestions`);
    }
    
    return summary.join('. ');
  }
}

// Export for use in coordinator
export default BusinessLogicValidatorAgent;