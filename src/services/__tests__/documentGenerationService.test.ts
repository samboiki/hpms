import { DocumentGenerationService } from '../documentGenerationService';

describe('DocumentGenerationService - Invoice Generation Edge Cases', () => {
  let service: DocumentGenerationService;

  beforeEach(() => {
    // The service is a plain class (no getInstance), so this suite never ran before
    service = new DocumentGenerationService();
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

    // The template builder is private; reach it through a narrow structural type
    type InvoiceTemplate = { createInvoiceHTMLWithBeautifulStyling: (...args: unknown[]) => Promise<string> };
    const render = (practice: Record<string, unknown>, invoice: Record<string, unknown>) =>
      (service as unknown as InvoiceTemplate).createInvoiceHTMLWithBeautifulStyling(mockVisit, practice, invoice, mockPatientInfo, null, '');
    const billedInvoice = {
      invoice_number: 'INV-010',
      total: 1200,
      created_at: '2026-10-01T09:00:00Z',
      due_date: '2026-10-31',
      invoice_services: [{ code: '0190', description: 'Consultation', quantity: 1, unit_price: 1200, total_price: 1200 }]
    };

    it('never prints invented bank details, so a patient cannot pay into an account that is not the practice\'s', async () => {
      const html = await render(mockPractice, billedInvoice);

      expect(html).not.toContain('BANKING DETAILS');
      expect(html).not.toContain('11223344556');
      expect(html).not.toContain('FNB Namibia');
    });

    it("prints the practice's own bank details when they are set", async () => {
      const html = await render(
        { ...mockPractice, bank_name: 'Bank Windhoek', account_number: '8001234567', branch_code: '483872' },
        billedInvoice
      );

      expect(html).toContain('BANKING DETAILS');
      expect(html).toContain('Bank: Bank Windhoek Account: 8001234567 Branch: 483872');
    });

    it('shows the due date stored on the invoice, not 30 days from whenever the PDF is generated', async () => {
      const html = await render(mockPractice, billedInvoice);
      expect(html).toContain('31 Oct 2026');
    });

    it("shows the patient's portion from patient_total, so the medical aid share is not billed to the patient", async () => {
      // invoices_enhanced has no medical_aid_covered column; the old sum showed the full N$ 1,200.00
      const html = await render(mockPractice, { ...billedInvoice, medical_aid_total: 900, patient_total: 300 });
      expect(html).toMatch(/Patient Portion:<\/td>\s*<td[^>]*>N\$ 300\.00</);
    });
  });
});