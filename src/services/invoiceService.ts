import { supabase } from '../lib/supabase';
import {
  ServiceSelection,
  Invoice,
  InvoiceItem,
  InvoiceGenerationRequest,
  BillingCalculation,
  MedicalAidCoverage,
  PaymentRecord
} from '../types/billing';

export class InvoiceService {
  /**
   * Generate invoice from visit and selected services
   */
  async generateInvoiceFromVisit(request: InvoiceGenerationRequest): Promise<Invoice> {
    try {
      // Validate request
      if (!request.visitId || !request.patientId || !request.services.length) {
        throw new Error('Invalid invoice generation request');
      }

      // Calculate billing totals
      const calculation = await this.calculateBilling(request.services, request.medicalAidId);
      
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(request.practiceId);
      
      // Create invoice with services using new structure
      const invoice = await this.createInvoiceWithServices({
        invoiceNumber,
        patientId: request.patientId,
        visitId: request.visitId,
        notes: request.notes
      }, request.services);

      // Generate PDF if requested
      if (request.generatePdf) {
        // TODO: Implement PDF generation
        console.log('PDF generation requested for invoice:', invoice.invoiceNumber);
      }

      // Email if requested
      if (request.emailToPatient) {
        // TODO: Implement email sending
        console.log('Email requested for invoice:', invoice.invoiceNumber);
      }

      return invoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate billing totals including medical aid coverage
   */
  async calculateBilling(services: ServiceSelection[], medicalAidId?: string): Promise<BillingCalculation> {
    let subtotal = 0;
    let medicalAidTotal = 0;
    let patientTotal = 0;
    const preAuthServices: ServiceSelection[] = [];
    let hasUncoveredServices = false;

    // Get medical aid coverage if applicable
    let coverageMap: Map<string, MedicalAidCoverage> = new Map();
    if (medicalAidId) {
      const { data: coverage } = await supabase
        .from('medical_aid_coverage')
        .select('*')
        .eq('medical_aid_id', medicalAidId)
        .eq('is_active', true);

      if (coverage) {
        coverage.forEach(c => coverageMap.set(c.tariff_code, c));
      }
    }

    // Calculate totals for each service
    for (const service of services) {
      const serviceTotal = service.unitPrice * service.quantity;
      subtotal += serviceTotal;

      const coverage = coverageMap.get(service.code);
      if (coverage && medicalAidId) {
        // Calculate medical aid portion
        const coverageAmount = Math.min(
          serviceTotal * (coverage.coverage_percentage / 100),
          coverage.max_amount || serviceTotal
        );
        medicalAidTotal += coverageAmount;
        patientTotal += serviceTotal - coverageAmount;

        // Check for pre-authorization requirement
        if (coverage.requires_pre_auth) {
          preAuthServices.push(service);
        }
      } else {
        // No coverage - patient pays full amount
        patientTotal += serviceTotal;
        hasUncoveredServices = true;
      }
    }

    // Apply tax (15% VAT in Namibia - configurable)
    const taxRate = await this.getTaxRate();
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    return {
      services,
      subtotal,
      tax,
      total,
      medicalAidTotal,
      patientTotal: patientTotal + tax, // Tax typically paid by patient
      hasUncoveredServices,
      requiresPreAuthorization: preAuthServices.length > 0,
      preAuthServices
    };
  }

  /**
   * Create invoice record in database
   */
  private async createInvoice(params: {
    invoiceNumber: string;
    patientId: string;
    visitId: string;
    practiceId: string;
    calculation: BillingCalculation;
    notes?: string;
  }): Promise<Invoice> {
    // Try different table names for invoice storage
    let data = null;
    let error = null;
    
    // First try invoices_enhanced table
    try {
      const result = await supabase
        .from('invoices_enhanced')
        .insert([{
          invoice_number: params.invoiceNumber,
          patient_id: params.patientId,
          visit_id: params.visitId,
          practice_id: params.practiceId,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: this.calculateDueDate(),
          subtotal: params.calculation.subtotal,
          tax: params.calculation.tax,
          total: params.calculation.total,
          medical_aid_total: params.calculation.medicalAidTotal,
          patient_total: params.calculation.patientTotal,
          payment_status: 'pending',
          notes: params.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } catch (enhancedError) {
      console.warn('Enhanced invoices table not available, trying fallback:', enhancedError);
      
      // Try standard invoices table as fallback
      try {
        const result = await supabase
          .from('invoices')
          .insert([{
            invoice_number: params.invoiceNumber,
            patient_id: params.patientId,
            visit_id: params.visitId,
            practice_id: params.practiceId,
            issue_date: new Date().toISOString().split('T')[0],
            due_date: this.calculateDueDate(),
            subtotal: params.calculation.subtotal,
            tax: params.calculation.tax,
            total: params.calculation.total,
            medical_aid_total: params.calculation.medicalAidTotal,
            patient_total: params.calculation.patientTotal,
            payment_status: 'pending',
            notes: params.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      } catch (fallbackError) {
        console.warn('Standard invoices table not available, creating mock invoice:', fallbackError);
        
        // Create mock invoice for testing
        data = {
          id: crypto.randomUUID(),
          invoice_number: params.invoiceNumber,
          patient_id: params.patientId,
          visit_id: params.visitId,
          practice_id: params.practiceId,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: this.calculateDueDate(),
          subtotal: params.calculation.subtotal,
          tax: params.calculation.tax,
          total: params.calculation.total,
          medical_aid_total: params.calculation.medicalAidTotal,
          patient_total: params.calculation.patientTotal,
          payment_status: 'pending',
          notes: params.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        error = null;
      }
    }

    if (error) throw error;

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      patientId: data.patient_id,
      visitId: data.visit_id,
      practiceId: data.practice_id,
      issueDate: data.issue_date,
      dueDate: data.due_date,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      paymentStatus: data.payment_status,
      medicalAidAmount: data.medical_aid_total,
      patientAmount: data.patient_total,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Create invoice items for each service
   */
  private async createInvoiceItems(
    invoiceId: string, 
    services: ServiceSelection[], 
    medicalAidId?: string
  ): Promise<void> {
    try {
      // Get medical aid coverage for amount calculations
      let coverageMap: Map<string, MedicalAidCoverage> = new Map();
      if (medicalAidId) {
        try {
          const { data: coverage } = await supabase
            .from('medical_aid_coverage')
            .select('*')
            .eq('medical_aid_id', medicalAidId)
            .eq('is_active', true);

          if (coverage) {
            coverage.forEach(c => coverageMap.set(c.tariff_code, c));
          }
        } catch (coverageError) {
          console.warn('Medical aid coverage table not available:', coverageError);
        }
      }

      const invoiceItems = services.map(service => {
        const totalPrice = service.unitPrice * service.quantity;
        const coverage = coverageMap.get(service.code);
        
        let medicalAidAmount = 0;
        let patientAmount = totalPrice;

        if (coverage && medicalAidId) {
          medicalAidAmount = Math.min(
            totalPrice * (coverage.coverage_percentage / 100),
            coverage.max_amount || totalPrice
          );
          patientAmount = totalPrice - medicalAidAmount;
        }

        return {
          invoice_id: invoiceId,
          tariff_code_id: service.tariffId,
          code: service.code,
          description: service.description,
          quantity: service.quantity,
          unit_price: service.unitPrice,
          total_price: totalPrice,
          medical_aid_covered: !!coverage,
          medical_aid_amount: medicalAidAmount,
          patient_amount: patientAmount,
          notes: service.notes
        };
      });

      // Try enhanced invoice items table first, then fallback
      try {
        const { error } = await supabase
          .from('invoice_items_enhanced')
          .insert(invoiceItems);
        if (error) throw error;
      } catch (enhancedError) {
        console.warn('Enhanced invoice items table not available, trying fallback:', enhancedError);
        try {
          const { error } = await supabase
            .from('invoice_items')
            .insert(invoiceItems);
          if (error) throw error;
        } catch (fallbackError) {
          console.warn('Invoice items table not available, items stored in memory only:', fallbackError);
          // Continue without storing items - this is for testing purposes
        }
      }
    } catch (error) {
      console.warn('Unable to create invoice items:', error);
      // Don't throw error - allow invoice creation to continue for testing
    }
  }

  /**
   * Create invoice with services using new table structure
   */
  private async createInvoiceWithServices(
    invoiceData: any,
    services: ServiceSelection[]
  ): Promise<any> {
    try {
      // First create the invoice (practice_id and medical aid details auto-populated by trigger)
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .insert([{
          patient_id: invoiceData.patientId,
          visit_id: invoiceData.visitId,
          due_date: this.calculateDueDate(),
          notes: invoiceData.notes
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Then create invoice services
      const invoiceServices = services.map(service => ({
        invoice_id: invoice.id,
        tariff_id: service.tariffId,
        code: service.code,
        description: service.description,
        quantity: service.quantity,
        unit_price: service.unitPrice,
        total_price: service.totalPrice,
        medical_aid_covered: 0, // Default to no medical aid coverage
        patient_portion: service.totalPrice, // Patient pays full amount initially
        notes: service.notes || ''
      }));

      const { error: servicesError } = await supabase
        .from('invoice_services')
        .insert(invoiceServices);

      if (servicesError) throw servicesError;

      // Return the complete invoice with updated totals (calculated by triggers)
      const { data: updatedInvoice, error: fetchError } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('id', invoice.id)
        .single();

      if (fetchError) throw fetchError;

      return {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoice_number,
        patientId: updatedInvoice.patient_id,
        visitId: updatedInvoice.visit_id,
        practiceId: updatedInvoice.practice_id,
        issueDate: updatedInvoice.issue_date,
        dueDate: updatedInvoice.due_date,
        subtotal: updatedInvoice.subtotal,
        tax: updatedInvoice.tax,
        total: updatedInvoice.total,
        paymentStatus: updatedInvoice.payment_status,
        medicalAidAmount: updatedInvoice.medical_aid_total,
        patientAmount: updatedInvoice.patient_total,
        notes: updatedInvoice.notes,
        createdAt: updatedInvoice.created_at,
        updatedAt: updatedInvoice.updated_at
      };
    } catch (error) {
      console.error('Error creating invoice with services:', error);
      throw error;
    }
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(practiceId: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Get the last invoice number for this practice
    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('practice_id', practiceId)
      .like('invoice_number', `INV${year}${month}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Error fetching last invoice number:', error);
    }

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastNumber = data[0].invoice_number;
      const numberPart = lastNumber.slice(-5); // Last 5 digits
      nextNumber = parseInt(numberPart) + 1;
    }

    return `INV${year}${month}${nextNumber.toString().padStart(5, '0')}`;
  }

  /**
   * Calculate due date based on practice settings
   */
  private calculateDueDate(paymentTermsDays: number = 30): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    return dueDate.toISOString().split('T')[0];
  }

  /**
   * Get tax rate from practice settings
   */
  private async getTaxRate(): Promise<number> {
    // Default to 15% VAT for Namibia
    // TODO: Get from practice settings
    return 15;
  }

  /**
   * Update invoice payment status
   */
  async updatePaymentStatus(
    invoiceId: string, 
    status: Invoice['paymentStatus'],
    paymentMethod?: string,
    amountPaid?: number,
    reference?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('invoices')
      .update({
        payment_status: status,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (error) throw error;

    // Record payment if amount provided
    if (amountPaid && amountPaid > 0) {
      await this.recordPayment({
        invoiceId,
        amount: amountPaid,
        paymentMethod: paymentMethod as any || 'cash',
        reference,
        paymentDate: new Date().toISOString(),
        processedBy: 'system' // TODO: Get from current user
      });
    }
  }

  /**
   * Record a payment against an invoice
   */
  async recordPayment(payment: Omit<PaymentRecord, 'id'>): Promise<PaymentRecord> {
    const { data, error } = await supabase
      .from('payment_records')
      .insert([{
        invoice_id: payment.invoiceId,
        amount: payment.amount,
        payment_method: payment.paymentMethod,
        payment_date: payment.paymentDate,
        reference: payment.reference,
        notes: payment.notes,
        processed_by: payment.processedBy
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      invoiceId: data.invoice_id,
      amount: data.amount,
      paymentMethod: data.payment_method,
      paymentDate: data.payment_date,
      reference: data.reference,
      notes: data.notes,
      processedBy: data.processed_by
    };
  }

  /**
   * Get invoice by ID with all related data
   */
  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        patient:patients(*),
        visit:visits(*),
        invoice_items(*),
        payment_records(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      patientId: data.patient_id,
      visitId: data.visit_id,
      practiceId: data.practice_id,
      issueDate: data.issue_date,
      dueDate: data.due_date,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      paymentStatus: data.payment_status,
      paymentMethod: data.payment_method,
      medicalAidClaimNumber: data.medical_aid_claim_number,
      medicalAidStatus: data.medical_aid_status,
      medicalAidAmount: data.medical_aid_total,
      patientAmount: data.patient_total,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Get invoices for a patient using new enhanced table
   */
  async getPatientInvoices(patientId: string): Promise<Invoice[]> {
    try {
      const { data, error } = await supabase
        .from('invoices_enhanced')
        .select(`
          *,
          invoice_services(
            id,
            code,
            description,
            quantity,
            unit_price,
            total_price,
            medical_aid_covered,
            patient_portion
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(invoice => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        patientId: invoice.patient_id,
        visitId: invoice.visit_id,
        practiceId: invoice.practice_id,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        paymentStatus: invoice.payment_status,
        paymentMethod: invoice.payment_method,
        medicalAidClaimNumber: invoice.medical_aid_claim_number,
        medicalAidStatus: invoice.medical_aid_status,
        medicalAidAmount: invoice.medical_aid_total,
        patientAmount: invoice.patient_total,
        notes: invoice.notes,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        services: invoice.invoice_services || []
      }));
    } catch (error) {
      console.error('Error fetching patient invoices:', error);
      return [];
    }
  }

  /**
   * Get billing statistics for patient from invoice view
   */
  async getPatientBillingStats(patientId: string): Promise<{
    totalInvoices: number;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    overdueinvoices: number;
    medicalAidAmount: number;
    patientAmount: number;
  }> {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('patient_id', patientId);

      if (error) throw error;

      const stats = {
        totalInvoices: invoices?.length || 0,
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueinvoices: 0,
        medicalAidAmount: 0,
        patientAmount: 0
      };

      if (invoices) {
        const today = new Date().toISOString().split('T')[0];
        
        invoices.forEach(invoice => {
          stats.totalAmount += invoice.total || 0;
          stats.medicalAidAmount += invoice.medical_aid_total || 0;
          stats.patientAmount += invoice.patient_total || 0;
          
          if (invoice.payment_status === 'paid') {
            stats.paidAmount += invoice.total || 0;
          } else {
            stats.outstandingAmount += invoice.total || 0;
            
            if (invoice.due_date < today) {
              stats.overdueinvoices += 1;
            }
          }
        });
      }

      return stats;
    } catch (error) {
      console.error('Error fetching patient billing stats:', error);
      return {
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueinvoices: 0,
        medicalAidAmount: 0,
        patientAmount: 0
      };
    }
  }

  /**
   * Get recent transactions for patient
   */
  async getPatientTransactions(patientId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('invoice_services_view')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching patient transactions:', error);
      return [];
    }
  }

  /**
   * Submit medical aid claim for invoice
   */
  async submitMedicalAidClaim(invoiceId: string): Promise<string> {
    // Generate claim number
    const claimNumber = `CLM${Date.now()}`;
    
    const { error } = await supabase
      .from('invoices')
      .update({
        medical_aid_claim_number: claimNumber,
        medical_aid_status: 'submitted',
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (error) throw error;

    // TODO: Integrate with actual medical aid EDI system
    console.log('Medical aid claim submitted:', claimNumber);

    return claimNumber;
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();