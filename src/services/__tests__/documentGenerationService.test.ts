import { DocumentGenerationService } from '../documentGenerationService';

describe('DocumentGenerationService - Invoice Generation Edge Cases', () => {
  let service: DocumentGenerationService;

  beforeEach(() => {
    service = DocumentGenerationService.getInstance();
  });

  describe('createInvoiceHTMLWithBeautifulStyling', () => {
    const mockPractice = {
      name: 'Test Practice',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country',
      primary_color: '#01b9d4'
    };

    const mockPatientInfo = {
      name: 'Test Patient',
      medical_record_number: 'MRN001'
    };

    const mockVisit = {
      visit_date: new Date().toISOString()
    };

    it('should handle invoice with null services', async () => {
      const invoice = {
        invoice_number: 'INV-001',
        total: 100,
        medical_aid_covered: 0,
        created_at: new Date().toISOString(),
        invoice_services: null
      };

      // This should not throw an error
      const html = await (service as any).createInvoiceHTMLWithBeautifulStyling(
        mockVisit,
        mockPractice,
        invoice,
        mockPatientInfo,
        null,
        ''
      );

      expect(html).toBeDefined();
      expect(html).toContain('INV-001');
      expect(html).not.toContain('undefined');
    });

    it('should handle invoice with empty services array', async () => {
      const invoice = {
        invoice_number: 'INV-002',
        total: 0,
        medical_aid_covered: 0,
        created_at: new Date().toISOString(),
        invoice_services: []
      };

      const html = await (service as any).createInvoiceHTMLWithBeautifulStyling(
        mockVisit,
        mockPractice,
        invoice,
        mockPatientInfo,
        null,
        ''
      );

      expect(html).toBeDefined();
      expect(html).toContain('N$ 0.00'); // Should show zero totals
    });

    it('should handle services with missing price fields', async () => {
      const invoice = {
        invoice_number: 'INV-003',
        total: 150,
        medical_aid_covered: 50,
        created_at: new Date().toISOString(),
        invoice_services: [
          {
            code: 'SRV001',
            description: 'Consultation',
            quantity: null,
            unit_price: null,
            total_price: null,
            medical_aid_covered: null
          },
          {
            code: 'SRV002',
            description: 'Lab Test',
            quantity: 2,
            unit_price: 75,
            total_price: 150,
            medical_aid_covered: 50
          }
        ]
      };

      const html = await (service as any).createInvoiceHTMLWithBeautifulStyling(
        mockVisit,
        mockPractice,
        invoice,
        mockPatientInfo,
        null,
        ''
      );

      expect(html).toBeDefined();
      expect(html).toContain('N$ 0.00'); // Null prices should default to 0
      expect(html).toContain('N$ 150.00'); // Valid prices should show correctly
    });

    it('should handle invoice with undefined fields', async () => {
      const invoice = {
        invoice_number: undefined,
        total: undefined,
        medical_aid_covered: undefined,
        created_at: undefined,
        invoice_services: undefined
      };

      const html = await (service as any).createInvoiceHTMLWithBeautifulStyling(
        mockVisit,
        mockPractice,
        invoice,
        mockPatientInfo,
        null,
        ''
      );

      expect(html).toBeDefined();
      expect(html).toContain('N/A'); // Should show N/A for missing invoice number
      expect(html).toContain('N$ 0.00'); // Should default to 0 for missing totals
    });

    it('should handle completely null invoice', async () => {
      const invoice = null;

      // This should not throw an error due to optional chaining
      const html = await (service as any).createInvoiceHTMLWithBeautifulStyling(
        mockVisit,
        mockPractice,
        invoice,
        mockPatientInfo,
        null,
        ''
      );

      expect(html).toBeDefined();
      expect(html).toContain('N/A'); // Should show N/A for missing data
    });

    it('should calculate subtotal correctly with mixed valid/invalid services', async () => {
      const invoice = {
        invoice_number: 'INV-004',
        total: 300,
        medical_aid_covered: 100,
        created_at: new Date().toISOString(),
        invoice_services: [
          { total_price: 100 },
          { total_price: null },
          { total_price: undefined },
          { total_price: 200 },
          {} // No total_price property
        ]
      };

      const html = await (service as any).createInvoiceHTMLWithBeautifulStyling(
        mockVisit,
        mockPractice,
        invoice,
        mockPatientInfo,
        null,
        ''
      );

      expect(html).toBeDefined();
      expect(html).toContain('N$ 300.00'); // Subtotal should be 100 + 200 = 300
    });
  });
});