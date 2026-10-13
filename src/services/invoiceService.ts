import { format } from 'date-fns';
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
import { verifyLineAmounts } from '../utils/billing/pricing';
import { formatServiceDate, isValidDateKey, todayKey } from '../utils/billing/dates';
import { formatNad, hasAtMostDecimals, toCents } from '../utils/billing/money';
import { buildInvoiceLineRows, type InvoiceLineRow } from '../utils/billing/invoiceLineRow';
import { billingRightsProblem, defaultTreatingPractitionerId } from '../utils/billing/invoiceRights';
import { PROVISIONAL_NUMBER_ATTEMPTS, isInvoiceNumberClash, provisionalInvoiceNumber } from '../utils/billing/invoiceNumber';
import { copayFor, shareOf } from '../utils/billing/lineSplit';
import { loadPatientFundKey } from './fundPricingService';
import { loadCopayRules } from './invoiceContextService';
import { loadInvoicingSetup } from './invoicingSetup';

const TARIFF_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Problems that would put a wrong price or date on an invoice, one message per problem, naming the code.
 * Checked before anything is written: every line must come from the tariff list, a code that
 * cannot be multiplied has quantity 1, total = unit price x quantity to the cent, a discount is a
 * real amount no larger than the line, and a line's own service date is a real date, not in the future.
 */
export function findInvoiceLineProblems(services: ServiceSelection[], options: { today?: string } = {}): string[] {
  if (services.length === 0) return ['There are no services to bill.'];
  const today = options.today ?? todayKey();
  return services.flatMap(service => {
    const problems: string[] = [];
    if (!TARIFF_ID_PATTERN.test(service.tariffId ?? '')) {
      problems.push(`Code ${service.code} is not linked to a tariff in the tariff list, so its price cannot be verified.`);
    }
    if (service.canBeMultiplied === false && service.quantity !== 1) {
      problems.push(`Code ${service.code} is billed once per line but has quantity ${service.quantity}.`);
    }
    // A line with its own limit (8109: one per clinical staff member, at most 3)
    if (service.maxQuantity !== undefined && service.quantity > service.maxQuantity) {
      problems.push(`Code ${service.code} allows at most ${service.maxQuantity} on one line but has quantity ${service.quantity}.`);
    }
    const amounts = verifyLineAmounts(service.unitPrice, service.quantity, service.totalPrice);
    if (!amounts.ok) problems.push(`Code ${service.code}: ${amounts.message}.`);
    const discount = service.discountAmount ?? 0;
    if (discount !== 0) {
      if (typeof discount !== 'number' || !Number.isFinite(discount) || discount < 0 || !hasAtMostDecimals(discount, 2)) {
        problems.push(`Code ${service.code}: the discount must be an amount in N$ with at most 2 decimals.`);
      } else if (amounts.ok && toCents(discount) > toCents(amounts.total)) {
        problems.push(`Code ${service.code}: the discount ${formatNad(discount)} is more than the line (${formatNad(amounts.total)}).`);
      }
    }
    // Funds refuse a claim dated in the future, and a wrong date would put the service on another day's account
    if (service.serviceDate) {
      if (!isValidDateKey(service.serviceDate)) problems.push(`Code ${service.code}: the service date "${service.serviceDate}" is not a valid date.`);
      else if (service.serviceDate > today) problems.push(`Code ${service.code}: the service date ${formatServiceDate(service.serviceDate)} is in the future.`);
    }
    return problems;
  });
}

/** Lines whose stored split differs from the one sent: the database applied its old "medical aid pays all" rule. */
export function changedSplits(sent: readonly InvoiceLineRow[], stored: ReadonlyArray<{ code?: string | null; medical_aid_covered?: number | string | null; patient_portion?: number | string | null }>): string[] {
  const cents = (value: number | string | null | undefined) => toCents(Number(value ?? 0) || 0);
  const remaining = [...stored];
  return sent.flatMap(row => {
    const index = remaining.findIndex(item => item.code === row.code && cents(item.medical_aid_covered) + cents(item.patient_portion) === toCents(row.total_price));
    const match = index >= 0 ? remaining.splice(index, 1)[0] : undefined;
    if (!match) return [];
    return cents(match.patient_portion) === toCents(row.patient_portion) ? [] : [row.code];
  });
}

// issue_date/due_date are DATE columns in the practice's local calendar. toISOString() is UTC, so
// invoices created between 00:00 and 02:00 in Namibia (UTC+2) were dated the previous day/month.
const toLocalDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

export class InvoiceService {
  /**
   * Who is raising the invoice: any active staff member with billing rights (administrator, doctor, nurse,
   * receptionist; invoiceRights.ts). This is not the treating practitioner, who is recorded separately.
   */
  private async validateBillingUser(): Promise<{ id: string; role: string; name: string; practiceId: string | null; isActive: boolean }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required. Please log in to create invoices.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, full_name, email, is_active, practice_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) console.warn('Staff profile could not be read; using the sign-in role:', profileError.message);

    // Without a staff profile the sign-in role is used, as before. user_metadata is editable by the user, so it can
    // only ever be one of the clinical or front-desk roles (as in authStore), never admin
    const metadataRole = String((user.user_metadata ?? {}).role ?? '').toLowerCase();
    const role = profile?.role ?? (['doctor', 'nurse', 'receptionist'].includes(metadataRole) ? metadataRole : 'doctor');
    const isActive = profile?.is_active !== false;
    const problem = billingRightsProblem({ role, is_active: isActive });
    if (problem) throw new Error(problem);

    return {
      id: user.id,
      role,
      name: profile?.full_name || profile?.email || user.email || 'Unknown user',
      practiceId: profile?.practice_id ?? null,
      isActive
    };
  }

  /**
   * Public method to create invoice (called from forms)
   */
  async createInvoice(params: {
    patientId: string;
    visitId: string;
    services: ServiceSelection[];
    dueDate?: string;
    notes?: string;
    practiceId?: string;
    /** The treating practitioner; the visit's practitioner when absent */
    practitionerId?: string | null;
  }): Promise<any> {
    try {
      // Convert to the format expected by createInvoiceWithServices (it checks who may raise invoices)
      const invoiceData = {
        patientId: params.patientId,
        visitId: params.visitId,
        practiceId: params.practiceId,
        practitionerId: params.practitionerId ?? null,
        notes: params.notes
      };

      return await this.createInvoiceWithServices(invoiceData, params.services);
    } catch (error) {
      console.error('💥 Error in createInvoice:', error);
      throw error; // Re-throw to maintain error handling in forms
    }
  }

  /**
   * Generate invoice from visit and selected services
   */
  async generateInvoiceFromVisit(request: InvoiceGenerationRequest): Promise<Invoice> {
    console.log('🏭 InvoiceService.generateInvoiceFromVisit starting...');
    console.log('📋 Request:', request);
    
    try {
      // Validate request
      console.log('✅ Validating request...');
      if (!request.visitId || !request.patientId || !request.services.length) {
        const error = 'Invalid invoice generation request - missing visitId, patientId, or services';
        console.error('❌ Validation failed:', error);
        console.error('📊 Request details:', {
          visitId: !!request.visitId,
          patientId: !!request.patientId,
          servicesCount: request.services.length
        });
        throw new Error(error);
      }

      console.log('✅ Request validation passed');

      // Calculate billing totals
      console.log('🧮 Calculating billing totals...');
      const calculation = await this.calculateBilling(request.services, request.medicalAidId);
      console.log('💰 Billing calculation:', calculation);
      
      // Create invoice with services using new structure
      console.log('💾 Creating invoice with services...');
      const invoiceData = {
        patientId: request.patientId,
        visitId: request.visitId,
        practiceId: request.practiceId,
        medicalAidId: request.medicalAidId,
        practitionerId: request.practitionerId ?? null,
        billPatientOnly: request.billPatientOnly === true,
        notes: request.notes
      };
      console.log('📋 Invoice data:', invoiceData);
      console.log('🛍️ Services data:', request.services);
      
      const invoice = await this.createInvoiceWithServices(invoiceData, request.services);
      console.log('✅ Invoice created successfully:', invoice);

      // Generate PDF if requested
      if (request.generatePdf) {
        console.log('📄 PDF generation requested for invoice:', invoice.invoiceNumber);
        // TODO: Implement PDF generation
      }

      // Email if requested
      if (request.emailToPatient) {
        console.log('📧 Email requested for invoice:', invoice.invoiceNumber);
        // TODO: Implement email sending
      }

      console.log('🎉 Invoice generation completed successfully!');
      return invoice;
    } catch (error) {
      console.error('💥 Error generating invoice:', error);
      console.error('📊 Error context:', {
        requestData: request,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate billing totals including medical aid coverage
   * SIMPLIFIED LOGIC: If patient has medical aid, medical aid covers 100% of services
   */
  async calculateBilling(services: ServiceSelection[], medicalAidId?: string): Promise<BillingCalculation> {
    let subtotal = 0;
    let medicalAidTotal = 0;
    let patientTotal = 0;
    const preAuthServices: ServiceSelection[] = [];
    let hasUncoveredServices = false;

    // Calculate subtotal
    for (const service of services) {
      const serviceTotal = service.unitPrice * service.quantity;
      subtotal += serviceTotal;
    }

    // Apply tax (15% VAT in Namibia)
    const taxRate = await this.getTaxRate();
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    // SIMPLIFIED MEDICAL AID LOGIC: If patient has medical aid, it covers 100%
    if (medicalAidId) {
      console.log('💳 Patient has medical aid - medical aid covers 100% of services');
      medicalAidTotal = total; // Medical aid covers everything including tax
      patientTotal = 0; // Patient pays nothing
      hasUncoveredServices = false;
    } else {
      console.log('💰 No medical aid - patient pays full amount');
      medicalAidTotal = 0;
      patientTotal = total; // Patient pays everything
      hasUncoveredServices = true;
    }

    console.log('🧮 Billing calculation:', {
      subtotal,
      tax,
      total,
      medicalAidTotal,
      patientTotal,
      hasMedicalAid: !!medicalAidId
    });

    return {
      services,
      subtotal,
      tax,
      total,
      medicalAidTotal,
      patientTotal,
      hasUncoveredServices,
      requiresPreAuthorization: false, // Simplified - no pre-auth required
      preAuthServices: []
    };
  }

  /**
   * Create invoice record in database
   */
  private async createInvoiceRecord(params: {
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
          issue_date: toLocalDateKey(new Date()),
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
          .from('invoices_enhanced')
          .insert([{
            invoice_number: params.invoiceNumber,
            patient_id: params.patientId,
            visit_id: params.visitId,
            practice_id: params.practiceId,
            issue_date: toLocalDateKey(new Date()),
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
        // Never return a made-up invoice: the visit would look billed while nothing was saved
        console.error('Invoice could not be saved:', fallbackError);
        throw new Error(`Invoice not created: ${fallbackError instanceof Error ? fallbackError.message : 'the connection to the database failed'}`);
      }
    }

    if (error) throw error;
    if (!data) throw new Error('Invoice not created: the database did not return the new invoice');

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
      const coverageMap: Map<string, MedicalAidCoverage> = new Map();
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
   * Creates the invoice and its lines.
   * - Who raises it: any staff member with billing rights (validateBillingUser); the treating practitioner is
   *   recorded on the invoice and its lines (the visit's practitioner unless another is chosen).
   * - Every line is checked and priced (buildInvoiceLineRow) BEFORE anything is written, so a refused line never
   *   leaves an empty invoice behind.
   * - The number: provisional (INV + yymm + 5 digits) until the database numbers invoices per practice in sequence
   *   (proposals/2026-10-07-invoicing.sql); a provisional number that is already taken is retried, not a failure.
   * - The fund/patient split follows the patient's medical aid record and the practice's co-payment for the fund.
   */
  private async createInvoiceWithServices(
    invoiceData: {
      patientId: string;
      visitId: string;
      practiceId?: string | null;
      medicalAidId?: string;
      practitionerId?: string | null;
      notes?: string;
      /** A cash-only account, confirmed by staff: every line is the patient's, so nothing is claimed */
      billPatientOnly?: boolean;
    },
    services: ServiceSelection[]
  ): Promise<any> {
    try {
      const raiser = await this.validateBillingUser();

      // Check every line before anything is written, so a wrong price never reaches an invoice
      // (a rejected request also no longer leaves an empty invoice behind)
      const lineProblems = findInvoiceLineProblems(services);
      if (lineProblems.length > 0) {
        throw new Error(`Invoice not created. ${lineProblems.join(' ')}`);
      }

      const [setup, visitResult, fundLoad] = await Promise.all([
        loadInvoicingSetup(),
        supabase.from('visits').select('id, visit_date, doctor_id, practice_id').eq('id', invoiceData.visitId).maybeSingle(),
        loadPatientFundKey({ patientId: invoiceData.patientId })
      ]);
      if (visitResult.error) console.warn('The visit could not be read; the invoice is dated today:', visitResult.error.message);
      const visit = visitResult.data;
      const practiceId = invoiceData.practiceId || visit?.practice_id || raiser.practiceId || null;
      const practitionerId =
        invoiceData.practitionerId ??
        defaultTreatingPractitionerId({ visitPractitionerId: visit?.doctor_id, raiser: { id: raiser.id, role: raiser.role, is_active: raiser.isActive } });

      // Medical aid or private is decided by the patient's medical aid record. Some screens flag every line as
      // medical aid, which left private patients with nothing to pay; the screen's flags are only used when the
      // record cannot be read.
      const frontendSaysMedicalAid = services.some(service => service.medicalAidCovered === true);
      // A cash-only account (account_flags, confirmed on the visit's Billing tab) is billed as private: nothing claimed
      const hasMedicalAid = invoiceData.billPatientOnly ? false : invoiceData.medicalAidId ? true : fundLoad.hasMedicalAid ?? frontendSaysMedicalAid;
      if (fundLoad.hasMedicalAid === null) console.warn('Medical aid lookup failed; using the billing screen flags:', fundLoad.error);
      const copay = hasMedicalAid ? await loadCopayRules(practiceId) : { rules: [], error: null };
      if (copay.error) console.warn('Co-payment rules could not be read; the fund is billed the whole line:', copay.error);
      // The fund's co-payment (a percentage or a fixed amount per line) and its levy (once per invoice)
      const share = shareOf(hasMedicalAid ? copayFor(copay.rules, fundLoad.fund) : null);

      // Priced and checked before the invoice exists (the invoice id is filled in after the insert)
      const lineContext = {
        hasMedicalAid,
        ...share,
        lineDetails: setup.lineDetails,
        // Each line's ICD-10 codes and a changed fee, once the database stores them
        lineCodes: setup.lineCodes,
        // Who pays a line when one side pays all of it, and its authorisation number (line-portions update)
        linePortions: setup.linePortions,
        // The surfaces of a line's one tooth and the quadrant (dental; line-teeth update)
        lineTeeth: setup.lineTeeth,
        // A line's own referral, its assistant and anaesthetist (referrals update)
        linePeople: setup.linePeople,
        // The promotion a line's discount came from and the prepaid package it was paid from (billing extras update)
        lineExtras: setup.lineExtras,
        defaultServiceDate: visit?.visit_date ?? toLocalDateKey(new Date()),
        defaultPractitionerId: practitionerId
      };
      // All lines at once, so the levy is charged once per invoice
      const draftRows = buildInvoiceLineRows(services, { ...lineContext, invoiceId: '' });

      const invoiceInsert: Record<string, unknown> = {
        patient_id: invoiceData.patientId,
        visit_id: invoiceData.visitId,
        // The treating practitioner (productivity and the claim); who raised it is created_by
        practitioner_id: practitionerId,
        due_date: this.calculateDueDate(),
        notes: invoiceData.notes,
        issue_date: toLocalDateKey(new Date()),
        payment_status: 'pending'
      };
      if (practiceId) invoiceInsert.practice_id = practiceId;
      if (setup.createdBy) invoiceInsert.created_by = raiser.id;

      type CreatedInvoice = { id: string; invoice_number: string; [key: string]: unknown };
      let invoice: CreatedInvoice | null = null;
      for (let attempt = 0; attempt < PROVISIONAL_NUMBER_ATTEMPTS && !invoice; attempt += 1) {
        const { data, error } = await supabase
          .from('invoices_enhanced')
          .insert([{ ...invoiceInsert, invoice_number: provisionalInvoiceNumber(new Date(), attempt) } as never])
          .select()
          .single();
        if (error && isInvoiceNumberClash(error) && attempt < PROVISIONAL_NUMBER_ATTEMPTS - 1) continue;
        if (error || !data) {
          // Never continue with a made-up invoice: the visit would look billed while nothing was saved
          throw new Error(`Invoice not created: ${error?.message || 'the database did not return the new invoice'}`);
        }
        invoice = data as unknown as CreatedInvoice;
      }
      if (!invoice) throw new Error('Invoice not created: no free invoice number was found. Try again.');

      // All lines were checked above; lines without a tariff are never dropped silently (the invoice would differ from the screen)
      const invoiceId = invoice.id;
      const invoiceServices = draftRows.map(row => ({ ...row, invoice_id: invoiceId }));
      const { data: insertedServices, error: servicesError } = await supabase
        .from('invoice_services')
        .insert(invoiceServices as never)
        .select('code, medical_aid_covered, patient_portion');
      if (servicesError) {
        throw new Error(`Invoice ${invoice.invoice_number} was created but its services could not be saved: ${servicesError.message}. Save the visit again to add them.`);
      }

      // The database may still apply its old rule (the medical aid pays every line in full) until the invoicing
      // update is applied: say so instead of showing a co-payment that was not kept
      const warnings: string[] = [];
      const overridden = changedSplits(invoiceServices, insertedServices ?? []);
      if (overridden.length > 0) {
        warnings.push(
          `The co-payment on ${overridden.join(', ')} was not kept: the database still bills the whole line to the medical aid. ` +
            'Apply the invoicing database update (proposals/2026-10-07-invoicing.sql) to bill co-payments.'
        );
      }

      // The totals are worked out by the database from the lines
      const { data: updatedInvoice, error: fetchError } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError || !updatedInvoice) {
        console.error('The new invoice could not be read back; showing the amounts of its lines:', fetchError);
        const sum = (pick: (row: InvoiceLineRow) => number) => invoiceServices.reduce((total, row) => total + toCents(pick(row)), 0) / 100;
        return {
          id: invoiceId,
          invoiceNumber: invoice.invoice_number,
          patientId: invoiceData.patientId,
          visitId: invoiceData.visitId,
          practiceId,
          issueDate: invoice.issue_date,
          dueDate: invoice.due_date,
          subtotal: sum(row => row.total_price),
          tax: 0,
          total: sum(row => row.total_price),
          paymentStatus: invoice.payment_status,
          medicalAidAmount: sum(row => row.medical_aid_covered),
          patientAmount: sum(row => row.patient_portion),
          notes: invoice.notes,
          createdAt: invoice.created_at,
          updatedAt: invoice.updated_at,
          practitionerId,
          warnings
        };
      }

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
        updatedAt: updatedInvoice.updated_at,
        practitionerId,
        warnings
      };
    } catch (error) {
      console.error('Error creating invoice with services:', error);
      throw error;
    }
  }

  /**
   * Calculate due date based on practice settings
   */
  private calculateDueDate(paymentTermsDays: number = 30): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    return toLocalDateKey(dueDate);
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
      .from('invoices_enhanced')
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
      .from('invoices_enhanced')
      .select(`
        *,
        patient:patients(*),
        visit:visits(*),
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
      notes: data.notes ?? undefined,
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
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get services for each invoice separately
      const invoicesWithServices = await Promise.all(
        (data || []).map(async (invoice) => {
          const { data: services } = await supabase
            .from('invoice_services')
            .select('*')
            .eq('invoice_id', invoice.id);

          return {
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
            services: services || []
          };
        })
      );

      return invoicesWithServices;
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
        const today = toLocalDateKey(new Date());
        
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
      // Use the invoices directly since the view might not have patient_id
      const { data, error } = await supabase
        .from('invoices_enhanced')
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
      .from('invoices_enhanced')
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