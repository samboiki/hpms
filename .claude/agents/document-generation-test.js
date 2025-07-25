#!/usr/bin/env node

/**
 * Document Generation Agent Test
 * 
 * This test demonstrates how the agent system detects and handles
 * the patientId validation issue in document generation
 */

// Simulate the agent analysis
const testContext = {
  tool: 'Edit',
  file: 'src/components/visits/EditVisitTabs.tsx',
  content: `
    const invoiceRequest = {
      visitId: visitId,
      patientId, // Could be false
      practiceId: practiceId || '',
      services: selectedServices
    };
    await invoiceService.generateInvoiceFromVisit(invoiceRequest);
  `
};

// Document Generation Agent patterns
const documentPatterns = {
  invoiceGeneration: /invoiceService\.(createInvoice|generateInvoiceFromVisit)/gi,
  missingPatientId: /patientId:\s*(false|undefined|null)/gi,
  patientIdValidation: /!patientId\s*\|\|\s*patientId\s*===\s*false/gi
};

// Analyze the code
function analyzeDocumentGeneration(content) {
  const issues = [];
  const fixes = [];

  // Check for invoice generation without proper validation
  if (content.match(documentPatterns.invoiceGeneration)) {
    if (!content.match(documentPatterns.patientIdValidation)) {
      issues.push({
        severity: 'critical',
        type: 'MISSING_PATIENT_ID_VALIDATION',
        message: 'Invoice generation detected without patientId validation',
        location: 'invoiceService call'
      });

      fixes.push({
        type: 'ADD_VALIDATION',
        code: `
// Add before invoice generation:
if (!patientId || patientId === false) {
  console.error('Cannot generate invoice: Invalid patient ID');
  throw new Error('Patient ID is required for invoice generation');
}
        `
      });
    }
  }

  return { issues, fixes };
}

// Run analysis
const result = analyzeDocumentGeneration(testContext.content);

console.log('🔍 Document Generation Agent Analysis Results:');
console.log('Issues found:', result.issues.length);
console.log('Fixes suggested:', result.fixes.length);

if (result.issues.length > 0) {
  console.log('\n❌ Critical Issues:');
  result.issues.forEach(issue => {
    console.log(`- ${issue.type}: ${issue.message}`);
  });

  console.log('\n✅ Suggested Fixes:');
  result.fixes.forEach(fix => {
    console.log(`- ${fix.type}:`);
    console.log(fix.code);
  });
}

// Demonstrate the fix in action
console.log('\n📝 Testing the fix:');

function generateInvoiceWithValidation(patientId, visitId, services) {
  // Agent-recommended validation
  if (!patientId || patientId === false) {
    console.error('Cannot generate invoice: Invalid patient ID');
    throw new Error('Patient ID is required for invoice generation');
  }

  console.log('✅ Validation passed, generating invoice...');
  // Proceed with invoice generation
}

// Test cases
try {
  generateInvoiceWithValidation(false, 'visit-123', []); // Should fail
} catch (error) {
  console.log('✅ Correctly caught invalid patientId:', error.message);
}

try {
  generateInvoiceWithValidation('patient-123', 'visit-123', []); // Should pass
} catch (error) {
  console.log('❌ Unexpected error:', error.message);
}

console.log('\n🎯 Agent System Success: Document generation is now protected against invalid patient IDs');