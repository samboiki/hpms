// Test script to verify invoice generation edge cases
import { documentGenerationService } from './src/services/documentGenerationService.js';

// Mock data for testing edge cases
const mockVisit = {
  id: 'test-visit-123',
  visit_date: new Date(),
  created_at: new Date(),
  patients: {
    id: 'test-patient-123',
    first_name: 'Test',
    last_name: 'Patient',
    date_of_birth: '1990-01-01',
    cell_number: '0812345678',
    email: 'test@example.com',
    home_address: '123 Test Street'
  },
  users: {
    id: 'test-doctor-123',
    full_name: 'Dr. Test Doctor',
    email: 'doctor@example.com',
    role: 'doctor'
  }
};

const mockPractice = {
  id: 'test-practice-123',
  name: 'Test Practice',
  logo_url: null,
  primary_color: '#01b9d4',
  address: '456 Practice Ave',
  contact_phone: '0811111111',
  contact_email: 'practice@example.com'
};

// Test cases
const testCases = [
  {
    name: 'Empty invoice services',
    invoice: {
      id: 'test-invoice-1',
      invoice_number: 'INV-001',
      total: 0,
      medical_aid_covered: 0,
      created_at: new Date(),
      invoice_services: []
    }
  },
  {
    name: 'Null invoice services',
    invoice: {
      id: 'test-invoice-2',
      invoice_number: 'INV-002',
      total: 0,
      medical_aid_covered: 0,
      created_at: new Date(),
      invoice_services: null
    }
  },
  {
    name: 'Undefined invoice services',
    invoice: {
      id: 'test-invoice-3',
      invoice_number: 'INV-003',
      total: 0,
      medical_aid_covered: 0,
      created_at: new Date(),
      invoice_services: undefined
    }
  },
  {
    name: 'Services with missing fields',
    invoice: {
      id: 'test-invoice-4',
      invoice_number: 'INV-004',
      total: 100,
      medical_aid_covered: 50,
      created_at: new Date(),
      invoice_services: [
        {
          code: null,
          description: undefined,
          quantity: null,
          unit_price: undefined,
          medical_aid_covered: null,
          total_price: undefined
        }
      ]
    }
  },
  {
    name: 'Services with string prices',
    invoice: {
      id: 'test-invoice-5',
      invoice_number: 'INV-005',
      total: 200,
      medical_aid_covered: 100,
      created_at: new Date(),
      invoice_services: [
        {
          code: 'TEST001',
          description: 'Test Service',
          quantity: '2',
          unit_price: '50.00',
          medical_aid_covered: '25.00',
          total_price: '100.00'
        }
      ]
    }
  },
  {
    name: 'Large number of services (pagination test)',
    invoice: {
      id: 'test-invoice-6',
      invoice_number: 'INV-006',
      total: 2000,
      medical_aid_covered: 1000,
      created_at: new Date(),
      invoice_services: Array(30).fill(null).map((_, i) => ({
        code: `TEST${i.toString().padStart(3, '0')}`,
        description: `Test Service ${i + 1}`,
        quantity: 1,
        unit_price: 50,
        medical_aid_covered: 25,
        total_price: 50
      }))
    }
  }
];

// Run tests
async function runTests() {
  console.log('🧪 Running Invoice Generation Edge Case Tests\n');
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('━'.repeat(50));
    
    try {
      // Test the createInvoiceHTMLWithBeautifulStyling method indirectly
      const result = await documentGenerationService.generateInvoice(
        mockVisit,
        mockPractice,
        testCase.invoice,
        null // medical aid
      );
      
      if (result) {
        console.log('✅ Success! Invoice generated');
        console.log(`   Document Name: ${result.documentName}`);
        console.log(`   File Size: ${result.fileSize} bytes`);
      } else {
        console.log('⚠️  No invoice generated (expected for empty data)');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      console.log('   Stack:', error.stack?.split('\n')[1]?.trim());
    }
  }
  
  console.log('\n\n✅ All edge case tests completed!');
}

// Execute tests
runTests().catch(console.error);