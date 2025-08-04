#!/usr/bin/env node
import { IntelligentAgent } from '../shared/agent-base.js';

/**
 * Error Detective Agent
 * 
 * Specializes in detecting and preventing React errors before they occur.
 * HPMS Context: Focuses on medical form components, appointment schedulers,
 * and patient management interfaces that are critical for healthcare operations.
 */
export class ErrorDetectiveAgent extends IntelligentAgent {
  constructor() {
    super({
      id: 'error-detective',
      name: 'Error Detective Agent',
      role: 'Detects and prevents React component errors before they occur',
      priority: 1, // High priority for error prevention
      hpmsContext: {
        criticalComponents: [
          'PremiumAppointmentScheduler',
          'ModernPatientRegistrationForm', 
          'PremiumAddVisitForm',
          'EditVisitTabs',
          'InvoiceGenerationModal'
        ],
        medicalWorkflows: ['patient-registration', 'appointment-scheduling', 'visit-recording'],
        errorPatterns: ['hook-dependency-issues', 'missing-keys', 'state-mutation', 'unhandled-promises']
      }
    });

    // Error detection patterns specific to HPMS React components
    this.errorPatterns = {
      // React Hook Errors
      hookDependencies: {
        pattern: /useEffect\s*\([^,]*,\s*\[\s*\]/g,
        severity: 'high',
        description: 'useEffect with empty dependency array may miss dependencies',
        hpmsContext: 'Critical in appointment scheduling and patient data forms'
      },

      hookConditional: {
        pattern: /if\s*\([^)]*\)\s*{\s*use[A-Z]/g,
        severity: 'critical',
        description: 'Conditional hook usage violates Rules of Hooks',
        hpmsContext: 'Can break medical form state management'
      },

      // Missing Keys in Lists
      missingKeys: {
        pattern: /\.map\s*\(\s*[^}]*=>\s*<[^>]*(?!.*key\s*=)/g,
        severity: 'high', 
        description: 'Missing key prop in mapped elements',
        hpmsContext: 'Critical for patient lists, appointment schedules, and medical records'
      },

      // State Management Errors
      directStateMutation: {
        pattern: /(patients|visits|appointments)\[[^\]]*\]\s*\.\s*\w+\s*=/g,
        severity: 'critical',
        description: 'Direct state mutation can cause component update issues',
        hpmsContext: 'Breaks patient data and appointment state updates'
      },

      asyncStateUpdate: {
        pattern: /(setState|set[A-Z][a-zA-Z]*)\s*\([^)]*await/g,
        severity: 'high',
        description: 'Async operations in state setters can cause race conditions',
        hpmsContext: 'Can corrupt patient data during form submissions'
      },

      // Error Boundary Issues
      missingErrorBoundary: {
        pattern: /(class\s+\w+.*extends.*Component|function\s+\w+.*Form)/g,
        severity: 'medium',
        description: 'Critical components should have error boundaries',
        hpmsContext: 'Medical forms need error boundaries for patient safety'
      },

      // Unhandled Promises
      unhandledPromise: {
        pattern: /(?<!await\s+|\.catch\(|try\s*{[^}]*)(fetch|axios\.|supabase\.|mcp__)/g,
        severity: 'high',
        description: 'Unhandled promises can cause silent failures',
        hpmsContext: 'Critical for SMS gateway, patient data, and appointment APIs'
      },

      // Form Validation Errors
      missingValidation: {
        pattern: /(onSubmit|handleSubmit)(?![^}]*validate)/g,
        severity: 'medium',
        description: 'Form submission without validation',
        hpmsContext: 'Medical forms must validate patient data for safety'
      },

      // Memory Leaks
      missingCleanup: {
        pattern: /useEffect\s*\([^}]*(?:setInterval|setTimeout|addEventListener)(?![^}]*return[^}]*clear|remove)/g,
        severity: 'medium',
        description: 'Effect with side effects missing cleanup',
        hpmsContext: 'Can cause memory leaks in long-running medical sessions'
      },

      // HPMS-Specific Patterns
      practiceIdMissing: {
        pattern: /(patients|visits|appointments).*\.(create|insert|update)(?![^}]*practice_id)/g,
        severity: 'critical',
        description: 'Database operation missing practice_id validation',
        hpmsContext: 'CRITICAL: Can cause cross-practice data corruption'
      },

      visitDateError: {
        pattern: /scheduled_date(?=.*visits)/g,
        severity: 'high',
        description: 'Using scheduled_date instead of visit_date',
        hpmsContext: 'HPMS-specific: Breaks appointment scheduling workflow'
      }
    };
  }

  /**
   * Execute error detection analysis
   */
  async execute(context) {
    const startTime = Date.now();
    await this.logActivity('starting-error-detection', { file: context.file });

    try {
      // Load existing knowledge
      const knowledge = await this.loadKnowledge();
      
      // Analyze code for error patterns
      const hpmsContext = this.analyzeHPMSContext(context.content || '', context.file || '');
      const detectedErrors = this.detectErrors(context.content || '', context.file || '');
      
      // Generate fixes for detected errors
      const autoFixes = this.generateAutoFixes(detectedErrors, context);
      
      // Create recommendations
      const recommendations = this.generateRecommendations(detectedErrors, hpmsContext);
      
      // Update knowledge base
      await this.updateKnowledge(knowledge, detectedErrors, context.file);
      
      const executionTime = Date.now() - startTime;
      
      const result = {
        agentId: this.id,
        executionTime,
        timestamp: new Date().toISOString(),
        hpmsContext,
        issues: detectedErrors,
        autoFixes,
        recommendations,
        summary: {
          totalErrors: detectedErrors.length,
          criticalErrors: detectedErrors.filter(e => e.severity === 'critical').length,
          autoFixableErrors: autoFixes.length,
          hpmsSpecificIssues: detectedErrors.filter(e => e.hpmsSpecific).length
        },
        performanceMetrics: {
          executionTime,
          patternChecks: Object.keys(this.errorPatterns).length,
          codeSize: (context.content || '').length
        }
      };

      await this.logActivity('completed-error-detection', { 
        errorsFound: detectedErrors.length,
        executionTime 
      });

      return result;

    } catch (error) {
      await this.logActivity('error-detection-failed', { error: error.message });
      throw new Error(`Error Detective Agent failed: ${error.message}`);
    }
  }

  /**
   * Detect errors using HPMS-aware patterns
   */
  detectErrors(code, filename = '') {
    const errors = [];
    const isReactComponent = filename.endsWith('.tsx') || filename.endsWith('.jsx');
    const isMedicalComponent = this.isMedicalComponent(filename, code);

    // Apply each error pattern
    Object.entries(this.errorPatterns).forEach(([patternName, pattern]) => {
      const matches = code.match(pattern.pattern) || [];
      
      matches.forEach(match => {
        const error = {
          type: `REACT_ERROR_${patternName.toUpperCase()}`,
          pattern: patternName,
          severity: pattern.severity,
          message: pattern.description,
          location: this.findErrorLocation(code, match),
          matchedCode: match,
          hpmsContext: pattern.hpmsContext,
          hpmsSpecific: patternName.includes('practiceId') || patternName.includes('visitDate'),
          
          // Additional context for medical components
          medicalComponent: isMedicalComponent,
          patientSafety: this.isPatientSafetyIssue(patternName),
          
          // Fix information
          autoFixable: this.isAutoFixable(patternName),
          fixComplexity: this.getFixComplexity(patternName)
        };

        // Enhance error with HPMS-specific context
        if (isMedicalComponent) {
          error.medicalWorkflowImpact = this.assessMedicalWorkflowImpact(patternName, filename);
        }

        errors.push(error);
      });
    });

    // Sort errors by severity and medical importance
    return this.prioritizeErrors(errors);
  }

  /**
   * Check if component is medical-related
   */
  isMedicalComponent(filename, code) {
    const medicalKeywords = ['Patient', 'Visit', 'Appointment', 'Medical', 'Invoice', 'Premium'];
    const hasMedicalKeyword = medicalKeywords.some(keyword => 
      filename.includes(keyword) || code.includes(keyword)
    );
    
    const isInMedicalContext = code.includes('practice_id') || 
                              code.includes('patient_id') ||
                              code.includes('visits');
    
    return hasMedicalKeyword || isInMedicalContext;
  }

  /**
   * Find approximate location of error in code
   */
  findErrorLocation(code, match) {
    const lines = code.split('\n');
    const matchIndex = code.indexOf(match);
    
    if (matchIndex === -1) return 'unknown';
    
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1; // +1 for newline
      if (charCount > matchIndex) {
        return `Line ${i + 1}`;
      }
    }
    
    return 'unknown';
  }

  /**
   * Check if error affects patient safety
   */
  isPatientSafetyIssue(patternName) {
    const safetyPatterns = [
      'practiceIdMissing',
      'directStateMutation', 
      'asyncStateUpdate',
      'unhandledPromise',
      'missingValidation'
    ];
    
    return safetyPatterns.includes(patternName);
  }

  /**
   * Check if error is auto-fixable
   */
  isAutoFixable(patternName) {
    const autoFixablePatterns = [
      'missingKeys',
      'missingCleanup',
      'visitDateError'
    ];
    
    return autoFixablePatterns.includes(patternName);
  }

  /**
   * Get fix complexity level
   */
  getFixComplexity(patternName) {
    const complexityMap = {
      'missingKeys': 'low',
      'missingValidation': 'low',
      'visitDateError': 'low',
      'missingCleanup': 'medium',
      'hookDependencies': 'medium',
      'unhandledPromise': 'medium',
      'directStateMutation': 'high',
      'hookConditional': 'high',
      'practiceIdMissing': 'critical'
    };
    
    return complexityMap[patternName] || 'medium';
  }

  /**
   * Assess impact on medical workflows
   */
  assessMedicalWorkflowImpact(patternName, filename) {
    const workflowImpacts = {
      'practiceIdMissing': 'CRITICAL - Can corrupt patient data across practices',
      'visitDateError': 'HIGH - Breaks appointment scheduling',
      'directStateMutation': 'HIGH - Can corrupt medical records',
      'unhandledPromise': 'MEDIUM - May cause silent API failures',
      'missingValidation': 'MEDIUM - Risk of invalid medical data',
      'hookConditional': 'MEDIUM - Can break medical form state'
    };
    
    const baseImpact = workflowImpacts[patternName] || 'LOW - General code quality issue';
    
    // Enhance based on component type
    if (filename.includes('Patient')) {
      return `${baseImpact} (Patient Management Impact)`;
    } else if (filename.includes('Visit') || filename.includes('Appointment')) {
      return `${baseImpact} (Clinical Workflow Impact)`;
    } else if (filename.includes('Invoice')) {
      return `${baseImpact} (Billing Process Impact)`;
    }
    
    return baseImpact;
  }

  /**
   * Prioritize errors by severity and medical importance
   */
  prioritizeErrors(errors) {
    return errors.sort((a, b) => {
      // Critical errors first
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      
      // Patient safety issues next
      if (a.patientSafety && !b.patientSafety) return -1;
      if (b.patientSafety && !a.patientSafety) return 1;
      
      // HPMS-specific issues
      if (a.hpmsSpecific && !b.hpmsSpecific) return -1;
      if (b.hpmsSpecific && !a.hpmsSpecific) return 1;
      
      // High severity
      if (a.severity === 'high' && b.severity !== 'high') return -1;
      if (b.severity === 'high' && a.severity !== 'high') return 1;
      
      return 0;
    });
  }

  /**
   * Generate auto-fixes for detected errors
   */
  generateAutoFixes(errors, context) {
    const autoFixes = [];
    
    errors.forEach(error => {
      if (!error.autoFixable) return;
      
      const fix = this.createAutoFix(error, context);
      if (fix) {
        autoFixes.push(fix);
      }
    });
    
    return autoFixes;
  }

  /**
   * Create specific auto-fix for an error
   */
  createAutoFix(error, context) {
    const fixes = {
      'missingKeys': {
        type: 'missing-key-prop',
        description: 'Add key prop to mapped elements',
        confidence: 0.9,
        risk: 'low',
        codeChange: error.matchedCode.replace(/(<[^>]+)(?!.*key\s*=)/, '$1 key={item.id || index}'),
        explanation: 'Added unique key prop for React list rendering optimization'
      },
      
      'visitDateError': {
        type: 'hpms-date-field',
        description: 'Fix HPMS date field usage',
        confidence: 0.95,
        risk: 'low',
        codeChange: error.matchedCode.replace(/scheduled_date/g, 'visit_date'),
        explanation: 'Fixed HPMS-specific field name: use visit_date for appointments'
      },
      
      'missingCleanup': {
        type: 'effect-cleanup',
        description: 'Add cleanup to useEffect',
        confidence: 0.8,
        risk: 'medium',
        codeChange: 'Add return () => { /* cleanup */ } to useEffect',
        explanation: 'Added cleanup function to prevent memory leaks'
      }
    };
    
    const fixTemplate = fixes[error.pattern];
    if (!fixTemplate) return null;
    
    return {
      ...fixTemplate,
      errorType: error.type,
      location: error.location,
      medicalContext: error.hpmsContext,
      patientSafetyRelevant: error.patientSafety
    };
  }

  /**
   * Generate recommendations for error prevention
   */
  generateRecommendations(errors, hpmsContext) {
    const recommendations = [];
    
    // Critical security recommendations
    const criticalErrors = errors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      recommendations.push({
        type: 'SECURITY_CRITICAL',
        title: 'Critical Security Issues Detected',
        message: `Found ${criticalErrors.length} critical errors that could compromise patient data security`,
        action: 'Review and fix immediately before deploying to production',
        medicalContext: 'Patient data security is paramount in healthcare applications'
      });
    }
    
    // Medical workflow recommendations
    const hpmsErrors = errors.filter(e => e.hpmsSpecific);
    if (hpmsErrors.length > 0) {
      recommendations.push({
        type: 'MEDICAL_WORKFLOW',
        title: 'HPMS Medical Workflow Issues',
        message: `Found ${hpmsErrors.length} HPMS-specific errors that could break medical workflows`,
        action: 'Review HPMS documentation and fix workflow-breaking issues',
        medicalContext: 'These errors specifically affect patient care processes'
      });
    }
    
    // Patient safety recommendations
    const safetyErrors = errors.filter(e => e.patientSafety);
    if (safetyErrors.length > 0) {
      recommendations.push({
        type: 'PATIENT_SAFETY',
        title: 'Patient Safety Concerns',
        message: `Found ${safetyErrors.length} errors that could affect patient safety`,
        action: 'Prioritize fixes for patient safety-related issues',
        medicalContext: 'Patient safety must be the top priority in medical software'
      });
    }
    
    // Component-specific recommendations
    if (hpmsContext.isMedicalForm) {
      recommendations.push({
        type: 'MEDICAL_FORM',
        title: 'Medical Form Error Prevention',
        message: 'Consider adding error boundaries and comprehensive validation',
        action: 'Implement ErrorBoundary components and form validation schemas',
        medicalContext: 'Medical forms require robust error handling for patient safety'
      });
    }
    
    return recommendations;
  }

  /**
   * Update knowledge base with new error patterns
   */
  async updateKnowledge(knowledge, detectedErrors, filename) {
    // Track error patterns over time
    if (!knowledge.errorPatterns) {
      knowledge.errorPatterns = {};
    }
    
    // Track file-specific errors
    if (!knowledge.fileErrors) {
      knowledge.fileErrors = {};
    }
    
    detectedErrors.forEach(error => {
      // Update pattern frequency
      if (!knowledge.errorPatterns[error.pattern]) {
        knowledge.errorPatterns[error.pattern] = { count: 0, files: [] };
      }
      knowledge.errorPatterns[error.pattern].count++;
      
      if (!knowledge.errorPatterns[error.pattern].files.includes(filename)) {
        knowledge.errorPatterns[error.pattern].files.push(filename);
      }
      
      // Update file-specific tracking
      if (!knowledge.fileErrors[filename]) {
        knowledge.fileErrors[filename] = { patterns: {}, lastCheck: null };
      }
      
      knowledge.fileErrors[filename].patterns[error.pattern] = 
        (knowledge.fileErrors[filename].patterns[error.pattern] || 0) + 1;
      knowledge.fileErrors[filename].lastCheck = new Date().toISOString();
    });
    
    // Track medical component patterns
    if (!knowledge.medicalComponents) {
      knowledge.medicalComponents = {};
    }
    
    const isMedical = this.isMedicalComponent(filename, '');
    if (isMedical && filename) {
      if (!knowledge.medicalComponents[filename]) {
        knowledge.medicalComponents[filename] = { errorCount: 0, lastAnalysis: null };
      }
      knowledge.medicalComponents[filename].errorCount = detectedErrors.length;
      knowledge.medicalComponents[filename].lastAnalysis = new Date().toISOString();
    }
    
    // Save updated knowledge
    await this.saveKnowledge(knowledge);
  }
}

// Create and export agent instance
const errorDetectiveAgent = new ErrorDetectiveAgent();

export default async function executeErrorDetective(context) {
  return await errorDetectiveAgent.execute(context);
}