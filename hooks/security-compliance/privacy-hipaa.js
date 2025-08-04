#!/usr/bin/env node
import { IntelligentAgent } from '../shared/agent-base.js';

/**
 * Privacy & HIPAA Agent
 * 
 * Specialized healthcare privacy compliance agent that ensures:
 * - HIPAA compliance for patient data handling
 * - Practice isolation and data segregation  
 * - Audit trail completeness
 * - Secure communication gateway usage
 * - Healthcare-specific privacy requirements
 */
export class PrivacyHIPAAAgent extends IntelligentAgent {
  constructor() {
    super({
      id: 'privacy-hipaa',
      name: 'Privacy & HIPAA Compliance Agent',
      role: 'Ensures healthcare privacy compliance and HIPAA requirements',
      priority: 1, // Critical priority for healthcare compliance
      hpmsContext: {
        complianceRequirements: ['HIPAA', 'practice-isolation', 'audit-trails', 'data-encryption'],
        criticalTables: ['patients', 'visits', 'medical_records', 'vitals'],
        secureGateways: ['centralized-sms-gateway', 'centralized-email-gateway'],
        forbiddenPatterns: ['cross-practice-access', 'direct-api-calls', 'unencrypted-patient-data']
      }
    });

    // HIPAA and healthcare privacy patterns
    this.privacyPatterns = {
      // Critical Security Violations
      crossPracticeAccess: {
        pattern: /practice_id\s*(?:\|\||&&|\?)\s*['"][^'"]*['"]|practice_id.*fallback|practice_id.*default/gi,
        severity: 'critical',
        complianceRisk: 'HIPAA_BREACH',
        description: 'Cross-practice data access vulnerability - can expose patient data across practices',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(4)',
        fix: 'Use getSafePracticeId(user) with proper validation'
      },

      hardcodedPracticeId: {
        pattern: /practice_id\s*=\s*['"][a-f0-9-]{36}['"]|practice_id.*uuid.*['"]/gi,
        severity: 'critical',
        complianceRisk: 'ACCESS_CONTROL_BREACH',
        description: 'Hardcoded practice ID creates security vulnerability',
        hipaaSection: 'Technical Safeguards § 164.312(a)(1)',
        fix: 'Always derive practice_id from authenticated user context'
      },

      // Direct API Violations (Bypassing Audit Trails)
      directSMSAPI: {
        pattern: /smsportal(?!.*gateway)|SMS.*API(?!.*gateway)|fetch.*sms(?!.*gateway)/gi,
        severity: 'critical', 
        complianceRisk: 'AUDIT_TRAIL_BYPASS',
        description: 'Direct SMS API usage bypasses required audit trails',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(1)(ii)(D)',
        fix: 'Use centralized-sms-gateway edge function for all SMS communications'
      },

      directEmailAPI: {
        pattern: /resend(?!.*gateway)|sendgrid(?!.*gateway)|fetch.*email(?!.*gateway)/gi,
        severity: 'critical',
        complianceRisk: 'AUDIT_TRAIL_BYPASS', 
        description: 'Direct email API usage bypasses required audit trails',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(1)(ii)(D)',
        fix: 'Use centralized-email-gateway edge function for all email communications'
      },

      // Patient Data Exposure
      unencryptedPatientData: {
        pattern: /patient.*(?:ssn|social|id_number|medical_aid).*=.*[^encrypt]/gi,
        severity: 'high',
        complianceRisk: 'DATA_ENCRYPTION',
        description: 'Patient sensitive data may not be properly encrypted',
        hipaaSection: 'Technical Safeguards § 164.312(a)(2)(iv)',
        fix: 'Ensure sensitive patient data is encrypted before storage'
      },

      patientDataInLogs: {
        pattern: /console\.log.*(?:patient|ssn|id_number|medical_aid)|logger.*patient/gi,
        severity: 'high',
        complianceRisk: 'DATA_EXPOSURE',
        description: 'Patient data logged to console - potential HIPAA violation',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(1)(ii)(D)',
        fix: 'Remove patient data from logs or use secure logging mechanisms'
      },

      // Missing Audit Trails
      unauditedDataAccess: {
        pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*(?:patients|visits|medical_records)(?!.*audit)/gi,
        severity: 'medium',
        complianceRisk: 'AUDIT_TRAIL_MISSING',
        description: 'Database operation on patient data without audit trail',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(1)(ii)(D)',
        fix: 'Ensure all patient data access is logged in audit_logs table'
      },

      // Access Control Issues
      missingRLS: {
        pattern: /supabase.*(?:patients|visits|medical_records).*(?:select|insert|update)(?!.*rls|RLS)/gi,
        severity: 'high',
        complianceRisk: 'ACCESS_CONTROL',
        description: 'Database access without Row Level Security validation',
        hipaaSection: 'Technical Safeguards § 164.312(a)(1)',
        fix: 'Ensure RLS policies are properly configured and enforced'
      },

      publicBucketAccess: {
        pattern: /supabase.*storage.*bucket.*public|bucket.*policy.*public/gi,
        severity: 'medium',
        complianceRisk: 'DATA_EXPOSURE',
        description: 'Public storage bucket may expose patient documents',
        hipaaSection: 'Technical Safeguards § 164.312(a)(1)',
        fix: 'Use private buckets with proper access controls for patient data'
      },

      // Communication Security
      unencryptedCommunication: {
        pattern: /http:\/\/(?!localhost)|ws:\/\/(?!localhost)/gi,
        severity: 'medium',
        complianceRisk: 'TRANSMISSION_SECURITY',
        description: 'Unencrypted HTTP communication in healthcare application',
        hipaaSection: 'Technical Safeguards § 164.312(e)(1)',
        fix: 'Use HTTPS/WSS for all communications in production'
      },

      // Data Retention Issues
      noDataRetentionPolicy: {
        pattern: /DELETE.*(?:patients|visits|medical_records)(?!.*retention|archive)/gi,
        severity: 'low',
        complianceRisk: 'DATA_RETENTION',
        description: 'Data deletion without retention policy consideration',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(7)(ii)(A)',
        fix: 'Implement proper data retention and archival policies'
      },

      // HPMS-Specific Security Patterns
      visitStatusBypass: {
        pattern: /visits.*status.*=.*(?!.*validate|auth)/gi,
        severity: 'medium',
        complianceRisk: 'WORKFLOW_SECURITY',
        description: 'Visit status change without proper authorization',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(4)',
        fix: 'Validate user authorization before changing visit status'
      },

      invoiceAmountManipulation: {
        pattern: /invoice.*amount.*=.*(?!.*validate|authorize)/gi,
        severity: 'high',
        complianceRisk: 'FINANCIAL_SECURITY',
        description: 'Invoice amount manipulation without authorization',
        hipaaSection: 'Administrative Safeguards § 164.308(a)(4)',
        fix: 'Implement proper authorization for financial data changes'
      }
    };

    // HIPAA compliance checklist items
    this.hipaaChecklist = {
      administrativeSafeguards: [
        'practice_isolation_enforced',
        'audit_trails_complete',
        'access_controls_implemented',
        'user_authorization_validated'
      ],
      physicalSafeguards: [
        'workstation_security',
        'device_controls',
        'media_controls'
      ],
      technicalSafeguards: [
        'access_control',
        'audit_controls', 
        'integrity',
        'person_authentication',
        'transmission_security'
      ]
    };
  }

  /**
   * Execute HIPAA compliance analysis
   */
  async execute(context) {
    const startTime = Date.now();
    await this.logActivity('starting-hipaa-analysis', { file: context.file });

    try {
      // Load existing compliance knowledge
      const knowledge = await this.loadKnowledge();
      
      // Analyze code for HIPAA compliance
      const hpmsContext = this.analyzeHPMSContext(context.content || '', context.file || '');
      const complianceIssues = this.analyzeCompliance(context.content || '', context.file || '');
      
      // Assess risk levels
      const riskAssessment = this.assessComplianceRisk(complianceIssues);
      
      // Generate compliance recommendations
      const recommendations = this.generateComplianceRecommendations(complianceIssues, hpmsContext);
      
      // Generate auto-fixes for safe compliance issues
      const autoFixes = this.generateComplianceAutoFixes(complianceIssues);
      
      // Update compliance knowledge
      await this.updateComplianceKnowledge(knowledge, complianceIssues, context.file);
      
      const executionTime = Date.now() - startTime;
      
      const result = {
        agentId: this.id,
        executionTime,
        timestamp: new Date().toISOString(),
        hpmsContext,
        complianceIssues,
        riskAssessment,
        recommendations,
        autoFixes,
        summary: {
          totalIssues: complianceIssues.length,
          criticalViolations: complianceIssues.filter(i => i.severity === 'critical').length,
          hipaaBreaches: complianceIssues.filter(i => i.complianceRisk.includes('BREACH')).length,
          auditTrailIssues: complianceIssues.filter(i => i.complianceRisk.includes('AUDIT')).length,
          overallRisk: riskAssessment.overallRisk
        },
        performanceMetrics: {
          executionTime,
          patternChecks: Object.keys(this.privacyPatterns).length,
          codeSize: (context.content || '').length
        }
      };

      await this.logActivity('completed-hipaa-analysis', { 
        issuesFound: complianceIssues.length,
        riskLevel: riskAssessment.overallRisk,
        executionTime 
      });

      return result;

    } catch (error) {
      await this.logActivity('hipaa-analysis-failed', { error: error.message });
      throw new Error(`Privacy & HIPAA Agent failed: ${error.message}`);
    }
  }

  /**
   * Analyze code for HIPAA compliance violations
   */
  analyzeCompliance(code, filename = '') {
    const issues = [];
    const isPatientDataComponent = this.isPatientDataComponent(filename, code);
    const isCommunicationComponent = this.isCommunicationComponent(filename, code);

    // Apply each compliance pattern
    Object.entries(this.privacyPatterns).forEach(([patternName, pattern]) => {
      const matches = code.match(pattern.pattern) || [];
      
      matches.forEach(match => {
        const issue = {
          type: `HIPAA_${patternName.toUpperCase()}`,
          pattern: patternName,
          severity: pattern.severity,
          complianceRisk: pattern.complianceRisk,
          description: pattern.description,
          hipaaSection: pattern.hipaaSection,
          location: this.findViolationLocation(code, match),
          matchedCode: match,
          suggestedFix: pattern.fix,
          
          // Context flags
          involvesPatientData: isPatientDataComponent,
          involvesCommunication: isCommunicationComponent,
          
          // Risk assessment
          riskLevel: this.calculateRiskLevel(pattern.severity, pattern.complianceRisk),
          complianceRequired: true,
          
          // HPMS-specific context
          hpmsSpecific: this.isHPMSSpecificPattern(patternName),
          practiceIsolationIssue: patternName.includes('Practice') || patternName.includes('crossPractice'),
          auditTrailIssue: pattern.complianceRisk.includes('AUDIT'),
          
          // Remediation information
          autoFixable: this.isComplianceAutoFixable(patternName),
          requiresManualReview: this.requiresManualReview(patternName),
          blocksDeployment: pattern.severity === 'critical'
        };

        // Add medical context if relevant
        if (isPatientDataComponent) {
          issue.medicalDataImpact = this.assessMedicalDataImpact(patternName);
        }

        // Add communication context
        if (isCommunicationComponent) {
          issue.communicationSecurityImpact = this.assessCommunicationSecurityImpact(patternName);
        }

        issues.push(issue);
      });
    });

    // Sort by risk level and severity
    return this.prioritizeComplianceIssues(issues);
  }

  /**
   * Check if component handles patient data
   */
  isPatientDataComponent(filename, code) {
    const patientDataIndicators = [
      'patients', 'patient_id', 'medical_records', 'vitals',
      'id_number', 'medical_aid', 'visits', 'PatientForm',
      'ModernPatientRegistration', 'EditPatient'
    ];

    return patientDataIndicators.some(indicator => 
      filename.includes(indicator) || code.includes(indicator)
    );
  }

  /**
   * Check if component handles communications
   */
  isCommunicationComponent(filename, code) {
    const communicationIndicators = [
      'sms', 'email', 'message', 'gateway', 'send',
      'SendMessage', 'communication', 'notification'
    ];

    return communicationIndicators.some(indicator =>
      filename.includes(indicator) || code.includes(indicator)
    );
  }

  /**
   * Find location of compliance violation
   */
  findViolationLocation(code, match) {
    const lines = code.split('\n');
    const matchIndex = code.indexOf(match);
    
    if (matchIndex === -1) return 'unknown';
    
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (charCount > matchIndex) {
        // Try to identify the function or component name
        const functionMatch = lines[i].match(/(?:function|const|class)\s+(\w+)/);
        const componentContext = functionMatch ? ` in ${functionMatch[1]}` : '';
        return `Line ${i + 1}${componentContext}`;
      }
    }
    
    return 'unknown';
  }

  /**
   * Calculate risk level based on severity and compliance risk
   */
  calculateRiskLevel(severity, complianceRisk) {
    const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    const riskWeights = {
      'HIPAA_BREACH': 5,
      'ACCESS_CONTROL_BREACH': 4,
      'AUDIT_TRAIL_BYPASS': 4,
      'DATA_ENCRYPTION': 3,
      'DATA_EXPOSURE': 3,
      'AUDIT_TRAIL_MISSING': 2,
      'ACCESS_CONTROL': 2,
      'TRANSMISSION_SECURITY': 2,
      'WORKFLOW_SECURITY': 1,
      'DATA_RETENTION': 1,
      'FINANCIAL_SECURITY': 3
    };

    const severityScore = severityWeights[severity] || 1;
    const riskScore = riskWeights[complianceRisk] || 1;
    const totalScore = severityScore * riskScore;

    if (totalScore >= 15) return 'CRITICAL';
    if (totalScore >= 10) return 'HIGH';
    if (totalScore >= 5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if pattern is HPMS-specific
   */
  isHPMSSpecificPattern(patternName) {
    const hpmsPatterns = [
      'crossPracticeAccess',
      'visitStatusBypass', 
      'invoiceAmountManipulation',
      'directSMSAPI',
      'directEmailAPI'
    ];
    
    return hpmsPatterns.includes(patternName);
  }

  /**
   * Check if compliance issue is auto-fixable
   */
  isComplianceAutoFixable(patternName) {
    const autoFixablePatterns = [
      'unencryptedCommunication',
      'patientDataInLogs'
    ];
    
    return autoFixablePatterns.includes(patternName);
  }

  /**
   * Check if issue requires manual review
   */
  requiresManualReview(patternName) {
    const manualReviewPatterns = [
      'crossPracticeAccess',
      'hardcodedPracticeId',
      'directSMSAPI',
      'directEmailAPI',
      'unauditedDataAccess',
      'invoiceAmountManipulation'
    ];
    
    return manualReviewPatterns.includes(patternName);
  }

  /**
   * Assess medical data impact
   */
  assessMedicalDataImpact(patternName) {
    const impacts = {
      'crossPracticeAccess': 'CRITICAL - Can expose patient records across practices',
      'unencryptedPatientData': 'HIGH - Patient sensitive data may be compromised',
      'patientDataInLogs': 'HIGH - Patient data exposed in application logs',
      'unauditedDataAccess': 'MEDIUM - Patient data access not properly tracked',
      'missingRLS': 'HIGH - Patient data access controls bypassed'
    };
    
    return impacts[patternName] || 'LOW - General data security issue';
  }

  /**
   * Assess communication security impact
   */
  assessCommunicationSecurityImpact(patternName) {
    const impacts = {
      'directSMSAPI': 'CRITICAL - SMS communications bypass audit trails',
      'directEmailAPI': 'CRITICAL - Email communications bypass audit trails',
      'unencryptedCommunication': 'MEDIUM - Communications may be intercepted'
    };
    
    return impacts[patternName] || 'LOW - General communication security issue';
  }

  /**
   * Prioritize compliance issues by risk and impact
   */
  prioritizeComplianceIssues(issues) {
    return issues.sort((a, b) => {
      // Critical violations first
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      
      // HIPAA breaches next
      if (a.complianceRisk.includes('BREACH') && !b.complianceRisk.includes('BREACH')) return -1;
      if (b.complianceRisk.includes('BREACH') && !a.complianceRisk.includes('BREACH')) return 1;
      
      // Patient data issues
      if (a.involvesPatientData && !b.involvesPatientData) return -1;
      if (b.involvesPatientData && !a.involvesPatientData) return 1;
      
      // Audit trail issues
      if (a.auditTrailIssue && !b.auditTrailIssue) return -1;
      if (b.auditTrailIssue && !a.auditTrailIssue) return 1;
      
      return 0;
    });
  }

  /**
   * Assess overall compliance risk
   */
  assessComplianceRisk(issues) {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const breachCount = issues.filter(i => i.complianceRisk.includes('BREACH')).length;
    const auditIssueCount = issues.filter(i => i.auditTrailIssue).length;

    let overallRisk = 'LOW';
    let riskFactors = [];

    if (criticalCount > 0) {
      overallRisk = 'CRITICAL';
      riskFactors.push(`${criticalCount} critical violations`);
    } else if (breachCount > 0) {
      overallRisk = 'HIGH';
      riskFactors.push(`${breachCount} potential HIPAA breaches`);
    } else if (highCount > 2) {
      overallRisk = 'HIGH';
      riskFactors.push(`${highCount} high-severity issues`);
    } else if (auditIssueCount > 0) {
      overallRisk = 'MEDIUM';
      riskFactors.push(`${auditIssueCount} audit trail issues`);
    }

    return {
      overallRisk,
      riskFactors,
      complianceScore: Math.max(0, 100 - (criticalCount * 25) - (highCount * 10) - (issues.length * 2)),
      deploymentRecommendation: criticalCount > 0 ? 'BLOCK_DEPLOYMENT' : 
                                 breachCount > 0 ? 'REQUIRE_REVIEW' : 'PROCEED_WITH_CAUTION'
    };
  }

  /**
   * Generate compliance-specific recommendations
   */
  generateComplianceRecommendations(issues, hpmsContext) {
    const recommendations = [];

    // Critical security recommendations
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        type: 'CRITICAL_HIPAA_VIOLATION',
        title: 'Critical HIPAA Violations Detected',
        message: `Found ${criticalIssues.length} critical HIPAA violations that must be fixed immediately`,
        action: 'BLOCK DEPLOYMENT - Fix all critical violations before proceeding',
        complianceRequirement: 'HIPAA Administrative Safeguards § 164.308',
        medicalContext: 'Critical violations can result in HIPAA penalties and patient data breaches'
      });
    }

    // Practice isolation recommendations
    const practiceIssues = issues.filter(i => i.practiceIsolationIssue);
    if (practiceIssues.length > 0) {
      recommendations.push({
        type: 'PRACTICE_ISOLATION',
        title: 'Practice Data Isolation Issues',
        message: `Found ${practiceIssues.length} practice isolation violations`,
        action: 'Review and fix practice_id validation and RLS policies',
        complianceRequirement: 'HIPAA Technical Safeguards § 164.312(a)(1)',
        medicalContext: 'Practice isolation prevents cross-contamination of patient data between healthcare practices'
      });
    }

    // Audit trail recommendations
    const auditIssues = issues.filter(i => i.auditTrailIssue);
    if (auditIssues.length > 0) {
      recommendations.push({
        type: 'AUDIT_TRAIL_COMPLIANCE',
        title: 'Audit Trail Requirements',
        message: `Found ${auditIssues.length} audit trail deficiencies`,
        action: 'Ensure all patient data access and communications are properly logged',
        complianceRequirement: 'HIPAA Administrative Safeguards § 164.308(a)(1)(ii)(D)',
        medicalContext: 'Complete audit trails are required for HIPAA compliance and security investigations'
      });
    }

    // Communication security recommendations
    const commIssues = issues.filter(i => i.involvesCommunication);
    if (commIssues.length > 0) {
      recommendations.push({
        type: 'SECURE_COMMUNICATION',
        title: 'Secure Communication Requirements',
        message: `Found ${commIssues.length} communication security issues`,
        action: 'Use centralized SMS/Email gateways for all patient communications',
        complianceRequirement: 'HIPAA Technical Safeguards § 164.312(e)(1)',
        medicalContext: 'All patient communications must be secure and properly audited'
      });
    }

    return recommendations;
  }

  /**
   * Generate auto-fixes for safe compliance issues
   */
  generateComplianceAutoFixes(issues) {
    const autoFixes = [];

    issues.forEach(issue => {
      if (!issue.autoFixable) return;

      const fix = this.createComplianceAutoFix(issue);
      if (fix) {
        autoFixes.push(fix);
      }
    });

    return autoFixes;
  }

  /**
   * Create specific auto-fix for compliance issue
   */
  createComplianceAutoFix(issue) {
    const fixes = {
      'unencryptedCommunication': {
        type: 'https-enforcement',
        description: 'Enforce HTTPS for secure communication',
        confidence: 0.9,
        risk: 'low',
        codeChange: issue.matchedCode.replace(/http:\/\//g, 'https://'),
        complianceImprovement: 'Meets HIPAA transmission security requirements'
      },

      'patientDataInLogs': {
        type: 'remove-patient-data-logs',
        description: 'Remove patient data from console logs',
        confidence: 0.85,
        risk: 'low',
        codeChange: '// Patient data logging removed for HIPAA compliance',
        complianceImprovement: 'Prevents patient data exposure in application logs'
      }
    };

    const fixTemplate = fixes[issue.pattern];
    if (!fixTemplate) return null;

    return {
      ...fixTemplate,
      issueType: issue.type,
      location: issue.location,
      hipaaSection: issue.hipaaSection,
      complianceRisk: issue.complianceRisk,
      deploymentBlocking: issue.blocksDeployment
    };
  }

  /**
   * Update compliance knowledge base
   */
  async updateComplianceKnowledge(knowledge, issues, filename) {
    // Track compliance patterns over time
    if (!knowledge.compliancePatterns) {
      knowledge.compliancePatterns = {};
    }

    // Track file compliance status
    if (!knowledge.fileCompliance) {
      knowledge.fileCompliance = {};
    }

    // Update pattern tracking
    issues.forEach(issue => {
      if (!knowledge.compliancePatterns[issue.pattern]) {
        knowledge.compliancePatterns[issue.pattern] = {
          count: 0,
          files: [],
          riskLevels: {},
          hipaaSection: issue.hipaaSection
        };
      }

      knowledge.compliancePatterns[issue.pattern].count++;
      if (!knowledge.compliancePatterns[issue.pattern].files.includes(filename)) {
        knowledge.compliancePatterns[issue.pattern].files.push(filename);
      }

      const riskLevel = issue.riskLevel;
      knowledge.compliancePatterns[issue.pattern].riskLevels[riskLevel] = 
        (knowledge.compliancePatterns[issue.pattern].riskLevels[riskLevel] || 0) + 1;
    });

    // Update file compliance status
    if (!knowledge.fileCompliance[filename]) {
      knowledge.fileCompliance[filename] = {
        complianceScore: 100,
        riskLevel: 'LOW',
        criticalIssues: 0,
        lastAudit: null,
        hipaaCompliant: true
      };
    }

    const fileEntry = knowledge.fileCompliance[filename];
    fileEntry.criticalIssues = issues.filter(i => i.severity === 'critical').length;
    fileEntry.complianceScore = Math.max(0, 100 - (issues.length * 5) - (fileEntry.criticalIssues * 20));
    fileEntry.riskLevel = issues.length > 0 ? 
      Math.max(...issues.map(i => this.calculateRiskLevel(i.severity, i.complianceRisk))) : 'LOW';
    fileEntry.hipaaCompliant = fileEntry.criticalIssues === 0;
    fileEntry.lastAudit = new Date().toISOString();

    // Track overall compliance metrics
    if (!knowledge.overallCompliance) {
      knowledge.overallCompliance = {
        totalFiles: 0,
        compliantFiles: 0,
        criticalViolations: 0,
        lastAssessment: null
      };
    }

    knowledge.overallCompliance.totalFiles = Object.keys(knowledge.fileCompliance).length;
    knowledge.overallCompliance.compliantFiles = 
      Object.values(knowledge.fileCompliance).filter(f => f.hipaaCompliant).length;
    knowledge.overallCompliance.criticalViolations = 
      Object.values(knowledge.fileCompliance).reduce((sum, f) => sum + f.criticalIssues, 0);
    knowledge.overallCompliance.lastAssessment = new Date().toISOString();

    // Save updated knowledge
    await this.saveKnowledge(knowledge);
  }
}

// Create and export agent instance
const privacyHIPAAAgent = new PrivacyHIPAAAgent();

export default async function executePrivacyHIPAA(context) {
  return await privacyHIPAAAgent.execute(context);
}