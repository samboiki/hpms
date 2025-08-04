#!/usr/bin/env node
import { IntelligentAgent } from './shared/agent-base.js';
import { HPMS_PATTERNS } from './shared/hpms-patterns.js';

/**
 * Document Generation Agent
 * 
 * Specializes in:
 * - Ensuring correct document generation for visits
 * - Validating invoice, prescription, and leave form data
 * - Optimizing PDF generation performance
 * - Tracking document generation issues
 */
class DocumentGenerationAgent extends IntelligentAgent {
  constructor() {
    super({
      id: 'document-generation',
      name: 'Document Generation Agent',
      role: 'Ensure correct PDF generation for medical documents',
      priority: 9,
      hpmsContext: {
        focusAreas: ['invoices', 'prescriptions', 'leave_forms', 'pdf_generation'],
        criticalPatterns: [
          'invoice generation request',
          'prescription formatting',
          'leave form validation',
          'document storage'
        ]
      }
    });
    
    // Document-specific patterns
    this.documentPatterns = {
      invoiceGeneration: /invoiceService\.(createInvoice|generateInvoiceFromVisit)/gi,
      missingPatientId: /patientId:\s*(false|undefined|null)/gi,
      documentService: /documentGenerationService\.generateVisitDocuments/gi,
      pdfGeneration: /html2canvas|jsPDF|htmlToPDF/gi,
      storageUpload: /supabase\.storage.*upload/gi
    };
  }

  /**
   * Analyze document generation operations
   */
  async analyze(context) {
    const results = {
      severity: 'info',
      issues: [],
      fixes: [],
      suggestions: [],
      performance: {}
    };

    // Check for invoice generation errors
    if (context.content?.includes('Invalid invoice generation request')) {
      results.severity = 'critical';
      results.issues.push({
        type: 'MISSING_PATIENT_ID',
        message: 'Invoice generation failing due to missing patientId',
        location: 'invoiceService validation',
        impact: 'Documents cannot be generated'
      });

      // Provide fix for missing patientId
      results.fixes.push({
        type: 'ADD_PATIENT_ID',
        description: 'Ensure patientId is passed to invoice generation',
        code: `// In EditVisitTabs.tsx or AddVisitTabs.tsx
const invoiceData = {
  patientId: patientId, // CRITICAL: Must include patientId
  visitId: visitId,
  practiceId: practiceId,
  services: selectedServices
};`
      });
    }

    // Check for document generation patterns
    if (context.tool === 'Edit' || context.tool === 'Write') {
      const content = context.content || '';
      
      // Check invoice service calls
      const invoiceMatches = content.match(this.documentPatterns.invoiceGeneration);
      if (invoiceMatches) {
        // Verify patientId is included
        if (!content.includes('patientId: patientId') && !content.includes('patientId,')) {
          results.issues.push({
            type: 'POTENTIAL_MISSING_PATIENT_ID',
            message: 'Invoice generation may be missing patientId parameter',
            severity: 'warning'
          });
        }
      }

      // Check document service integration
      if (content.match(this.documentPatterns.documentService)) {
        results.suggestions.push({
          type: 'DOCUMENT_GENERATION',
          message: 'Document generation service detected - ensure error handling',
          recommendation: 'Wrap in try-catch and don\'t fail visit save on document errors'
        });
      }

      // Performance checks for PDF generation
      if (content.match(this.documentPatterns.pdfGeneration)) {
        results.performance.pdfGeneration = {
          detected: true,
          recommendations: [
            'Use scale: 2 for optimal quality',
            'Clean up DOM elements after generation',
            'Use JPEG format with 0.95 quality for smaller files'
          ]
        };
      }
    }

    // Check for storage operations
    if (context.content?.match(this.documentPatterns.storageUpload)) {
      results.suggestions.push({
        type: 'STORAGE_OPTIMIZATION',
        message: 'Ensure proper folder structure in storage bucket',
        recommendation: 'Use folders: /prescriptions/, /leave_forms/, /invoices/'
      });
    }

    return results;
  }

  /**
   * Generate fixes for document generation issues
   */
  async generateFix(issue, context) {
    switch (issue.type) {
      case 'MISSING_PATIENT_ID':
        return {
          file: context.file,
          fix: `// Ensure patientId is passed to invoice generation
// Look for invoiceService calls and add patientId parameter`,
          severity: 'critical',
          autoApply: false // Manual fix needed
        };

      case 'POTENTIAL_MISSING_PATIENT_ID':
        return {
          file: context.file,
          fix: `// Verify invoice generation includes patientId:
// generateInvoiceFromVisit({ patientId, visitId, services, ... })`,
          severity: 'warning',
          autoApply: false
        };

      default:
        return null;
    }
  }

  /**
   * Track document generation patterns
   */
  async learn(context, result) {
    const knowledge = await this.loadKnowledge();
    
    // Track document generation success/failure
    if (context.content?.includes('Documents generated successfully')) {
      knowledge.statistics = knowledge.statistics || {};
      knowledge.statistics.successfulGenerations = (knowledge.statistics.successfulGenerations || 0) + 1;
    }

    if (context.content?.includes('Error generating documents')) {
      knowledge.statistics = knowledge.statistics || {};
      knowledge.statistics.failedGenerations = (knowledge.statistics.failedGenerations || 0) + 1;
    }

    // Track common issues
    if (result.issues.length > 0) {
      knowledge.commonIssues = knowledge.commonIssues || {};
      result.issues.forEach(issue => {
        knowledge.commonIssues[issue.type] = (knowledge.commonIssues[issue.type] || 0) + 1;
      });
    }

    await this.saveKnowledge(knowledge);
  }
}

// Export for coordinator
export default new DocumentGenerationAgent();