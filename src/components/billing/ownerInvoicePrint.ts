/**
 * Owner-designed print format: do not change the layout or look without the owner's explicit request.
 *
 * The practice's invoice and payment receipt exactly as the owner designed them (git bd02f25, the patient file's
 * Billing tab: ComprehensivePatientModal handleDirectPrintPDF and handleDirectReceiptPDF): the practice logo top left
 * over the practice name, the practice's details top right, "MEDICAL INVOICE #number" with Date prepared and Due date,
 * Prepared for (the patient on the left, the medical aid on the right), the Services table (Code, Description, Qty,
 * Unit price, Med aid, Total) with Subtotal, Patient portion and Total amount due, Banking details and the footer, in
 * Montserrat and Rubik on A4 pages of 794 x 1123 px, drawn into a PDF (html2canvas and jsPDF).
 *
 * The only content changes from the owner's version (each listed for him, 15 Oct 2026):
 * - A VAT-registered practice (owner decision 13 Oct 2026, Settings > Practice) prints "TAX INVOICE", its VAT number
 *   and, when stock lines carry VAT, the total excluding VAT and the VAT included. Nothing changes for other practices.
 * - Amounts are added up in whole cents and rounded half up (src/utils/billing/money.ts); they print as before
 *   ("N$ 1440.90"). The due date is the invoice's own due date, not 30 days after the day it is printed.
 * - Missing practice details are left out instead of printing "null" or "undefined".
 * - Text is escaped, so a description typed with "<" or "&" prints as typed and can never run as code.
 * - The receipt says RECEIPT DATE (the day it is printed) and the payment method as recorded ("Not recorded" when
 *   none was), instead of PAID DATE with today's date and "Cash" when nobody recorded a method.
 * - Asked by the owner (15 Oct 2026, "small, in my style"), on invoices only: NAMAF rule 008's practice number and
 *   treating practitioner's HPCNA number on one line under the contact details, and an ICD-10 column after Code when
 *   the lines have codes. A missing value is left out.
 * - When the last page had no room for the totals (14 lines, or more than 12 on a later page) they were cut off the
 *   PDF; they now go on a page of their own.
 */
import { format, isValid, parseISO } from 'date-fns';
import type { jsPDF } from 'jspdf';
import { formatAmount, fromCents, sumCents, toCents } from '../../utils/billing/money';
import { summariseVat, vatRateLabel } from '../../utils/billing/vat';

export interface OwnerPrintPractice {
  name: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** As printed under the contact details ("www.example.com"); '' when the practice has none (practiceWebsiteText) */
  website: string;
  /** NAMAF rule 008 (owner, 15 Oct 2026): printed on invoices only, on one small line under the contact details */
  practiceNumber?: string | null;
  bankName: string | null;
  accountNumber: string | null;
  branchCode: string | null;
}

export interface OwnerPrintPatient {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/** The patient's medical aid as the owner's "Prepared for" block shows it; null for a private patient */
export interface OwnerPrintMedicalAid {
  /** The fund's short name, else its name, else the name typed on the file */
  providerName: string | null;
  scheme: string | null;
  membershipNumber: string | null;
}

export interface OwnerPrintService {
  /** invoice_services.id: matches the line's ICD-10 codes and practitioner (rule-008 details) */
  id?: string;
  code: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  medicalAid: number;
  total: number;
  /** The VAT in the line's price, in per cent (0 or absent: a service, or a practice that is not VAT registered) */
  vatRate?: number;
  /** The line's ICD-10 code(s) (NAMAF rule 008): an invoice with any shows his table with an ICD-10 column */
  icd10?: readonly string[];
}

export interface OwnerInvoicePrint {
  kind: 'invoice' | 'receipt';
  invoiceNumber: string;
  /** When the invoice was made (DATE PREPARED) */
  createdAt: string;
  /** The invoice's own due date (yyyy-MM-dd); without one, 30 days after it was made ("Payment is due within 30 days") */
  dueDate: string | null;
  /** The day a receipt is printed (RECEIPT DATE) */
  receiptDate?: Date;
  /** How the invoice was paid, as recorded (receipt METHOD) */
  paymentMethodLabel?: string;
  practice: OwnerPrintPractice;
  patient: OwnerPrintPatient;
  medicalAid: OwnerPrintMedicalAid | null;
  services: readonly OwnerPrintService[];
  /** The invoice total (Total amount due / Amount paid) */
  total: number;
  /** The practice is VAT registered (Settings > Practice): its invoices are tax invoices with its VAT number */
  vat: { vatNumber: string } | null;
  /** The treating practitioner(s) (NAMAF rule 008): their HPCNA numbers print on invoices, next to the practice number */
  practitioners?: readonly { name: string; hpcnaNumber: string | null }[];
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const present = (value: string | null | undefined): value is string => Boolean(value && value.trim());

/** "N$ 1440.90": the owner's figures (no thousands separator), from an amount rounded to the cent */
const nad = (amount: number): string => `N$ ${formatAmount(Number.isFinite(amount) ? amount : 0, { thousands: false })}`;

const printDate = (value: string | Date): string => {
  const date = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : new Date(value);
  return isValid(date) ? format(date, 'dd MMM yyyy') : '';
};

const dueDateText = (print: OwnerInvoicePrint): string => {
  if (present(print.dueDate)) return printDate(print.dueDate.slice(0, 10));
  const made = new Date(print.createdAt);
  return isValid(made) ? printDate(new Date(made.getTime() + 30 * 24 * 60 * 60 * 1000)) : '';
};

/**
 * The owner's page breaks: up to 9 services fit on one page with the totals and footer; 10 to 13 go 10 on the first
 * page and the rest on a second; from 14, 14 on the first page and 20 on each page after it.
 */
export function paginateOwnerInvoiceServices<T>(services: readonly T[]): T[][] {
  const chunks: T[][] = [];
  if (services.length <= 9) {
    chunks.push([...services]);
  } else if (services.length <= 13) {
    chunks.push(services.slice(0, 10), services.slice(10));
  } else {
    chunks.push(services.slice(0, 14));
    for (let start = 14; start < services.length; start += 20) chunks.push(services.slice(start, start + 20));
  }
  // The totals, banking details and footer print on the last page. His breaks left them no room when the last page is
  // the first page with 14 lines, or a later page with more than 12: the totals were cut off the PDF (15 Oct 2026).
  // They then go on a page of their own, as his 10-line invoices already do.
  const last = chunks[chunks.length - 1];
  if (last.length > (chunks.length === 1 ? 9 : 12)) chunks.push([]);
  return chunks;
}

/** One A4 page of the owner's invoice or receipt, as HTML */
export function ownerInvoicePageHtml(
  print: OwnerInvoicePrint,
  pageServices: readonly OwnerPrintService[],
  pageNumber: number,
  totalPages: number,
  isLastPage: boolean
): string {
  const { practice, patient, medicalAid } = print;
  const receipt = print.kind === 'receipt';
  const location = [[practice.city, practice.country].filter(present).join(', '), practice.postalCode].filter(present).join(' ');
  const contact = [practice.contactPhone, practice.contactEmail].filter(present).map(escapeHtml).join(' • ');
  const providerName = medicalAid ? (present(medicalAid.providerName) ? medicalAid.providerName : 'N/A') : 'N/A';
  const showMedicalAid = Boolean(medicalAid && (present(medicalAid.scheme) || providerName !== 'N/A'));
  const subtotalCents = sumCents(print.services.map(service => toCents(Number(service.total) || 0)));
  const medicalAidCents = sumCents(print.services.map(service => toCents(Number(service.medicalAid) || 0)));
  const totalCents = toCents(Number(print.total) || 0);
  // A tax invoice (VAT-registered practice) shows the VAT inside its VAT-able stock lines; services carry none
  const vat = !receipt && print.vat
    ? summariseVat(print.services.map(service => ({ totalCents: toCents(Number(service.total) || 0), rate: service.vatRate ?? 0 })))
    : null;
  const title = receipt
    ? '<span style="color: #5f6578;">PAYMENT</span> <span style="color: #888;">RECEIPT</span>'
    : `<span style="color: #5f6578;">MEDICAL</span> <span style="color: #888;">${print.vat ? 'TAX INVOICE' : 'INVOICE'}</span>`;
  // NAMAF rule 008 on the invoice (owner, 15 Oct 2026: "small, in my style"): one line with the practice number and the
  // treating practitioner's HPCNA number under the contact details, and an ICD-10 column when the lines have codes.
  // A value that is missing is left out. Receipts are proof of payment and stay as they were.
  const hpcnaNumbers = receipt ? [] : [...new Set((print.practitioners ?? []).map(person => (person.hpcnaNumber ?? '').trim()).filter(Boolean))];
  const ruleEightLine = receipt
    ? ''
    : [
        present(practice.practiceNumber) ? `Practice No: ${escapeHtml(practice.practiceNumber.trim())}` : null,
        hpcnaNumbers.length > 0 ? `HPCNA No: ${escapeHtml(hpcnaNumbers.join(', '))}` : null
      ]
        .filter(Boolean)
        .join(' • ');
  const showIcd10 = !receipt && print.services.some(service => (service.icd10 ?? []).some(present));
  const labelColumns = showIcd10 ? 6 : 5;

  return `
    <div style="width: 794px; height: 1123px; font-family: 'Montserrat', sans-serif; font-size: 11px; line-height: 1.5; color: #2c2c2c; background-color: #ffffff; padding: 25px; margin: 0; box-sizing: border-box; position: relative;">

      <!-- Premium Header Section -->
      <div style="padding: 0; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-start;">

        <!-- Logo and Title on Left (Stacked) -->
        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1;">
          ${present(practice.logoUrl) ? `
            <div style="flex-shrink: 0;">
              <img src="${escapeHtml(practice.logoUrl)}" alt="Practice Logo" style="width: 120px; height: auto; max-height: 65px; border-radius: 8px; object-fit: contain;" />
            </div>
          ` : ''}
          <div>
            <div style="font-family: 'Rubik', sans-serif; font-size: 22px; font-weight: 800; color: #5f6578; letter-spacing: -0.2px;">
              ${escapeHtml(practice.name)}
            </div>
          </div>
        </div>

        <!-- Practice Details (right aligned) -->
        <div style="text-align: right; flex: 1; max-width: 300px;">
          <div style="font-size: 10px; line-height: 1.6; color: #5a5a5a; font-weight: 400;">
            ${present(practice.address) ? `<div style="margin-bottom: 2px;">${escapeHtml(practice.address)}</div>` : ''}
            ${location ? `<div style="margin-bottom: 2px;">${escapeHtml(location)}</div>` : ''}
            ${present(practice.contactPhone) ? `<div style="margin-bottom: 2px;">Tel: ${escapeHtml(practice.contactPhone)}</div>` : ''}
            ${present(practice.contactEmail) ? `<div style="margin-bottom: 2px;">Email: ${escapeHtml(practice.contactEmail)}</div>` : ''}
            ${ruleEightLine ? `<div style="margin-bottom: 2px;">${ruleEightLine}</div>` : ''}
            ${!receipt && print.vat ? `<div style="margin-bottom: 2px;">VAT no: ${escapeHtml(print.vat.vatNumber)}</div>` : ''}
            ${present(practice.website) ? `<div>${escapeHtml(practice.website)}</div>` : ''}
          </div>
        </div>
      </div>

      ${pageNumber === 1 ? `
      <!-- ${receipt ? 'Receipt' : 'Refined Invoice'} Title Section -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 20px 0; border-bottom: 2px solid #d1d5db;">
        <div style="display: flex; align-items: flex-end; gap: 15px;">
          <div style="font-family: 'Rubik', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">
            ${title}
          </div>
          <span style="font-size: 14px; font-weight: 600; color: #666; letter-spacing: 0.3px; align-self: flex-end;">#${receipt ? 'REC-' : ''}${escapeHtml(print.invoiceNumber)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px; font-size: 9px; color: #666;">
          <div style="text-align: center;">
            <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">${receipt ? 'RECEIPT DATE' : 'DATE PREPARED'}</div>
            <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${receipt ? printDate(print.receiptDate ?? new Date()) : printDate(print.createdAt)}</div>
          </div>
          <div style="border-left: 1px solid #d1d5db; height: 30px; margin: 0 5px;"></div>
          <div style="text-align: center;">
            <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">${receipt ? 'METHOD' : 'DUE DATE'}</div>
            <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${receipt ? escapeHtml(print.paymentMethodLabel ?? 'Not recorded') : dueDateText(print)}</div>
          </div>
        </div>
      </div>

      <!-- ${receipt ? 'PAYMENT RECEIVED FROM' : 'PREPARED FOR'} Section -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.3px;">${receipt ? 'PAYMENT RECEIVED FROM' : 'PREPARED FOR'}</h3>
        <div style="display: flex; justify-content: space-between; gap: 25px;">
          <!-- Patient Details -->
          <div style="flex: 1;">
            <div style="line-height: 1.4;">
              <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                ${escapeHtml(patient.name)}
              </div>
              ${present(patient.phone) ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${escapeHtml(patient.phone)}</div>` : ''}
              ${present(patient.email) ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${escapeHtml(patient.email)}</div>` : ''}
              ${present(patient.address) ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${escapeHtml(patient.address)}</div>` : ''}
            </div>
          </div>

          <!-- Medical Aid Details (Right Aligned) -->
          ${showMedicalAid ? `
            <div style="flex: 1; text-align: right;">
              <div style="line-height: 1.4;">
                <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                  ${escapeHtml(providerName)}
                </div>
                ${present(medicalAid?.scheme) ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Scheme: ${escapeHtml(medicalAid?.scheme)}</div>` : ''}
                ${present(medicalAid?.membershipNumber) ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Member: ${escapeHtml(medicalAid?.membershipNumber)}</div>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Service Details Section -->
      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; padding-bottom: 10px; border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.3px;">SERVICES ${pageNumber > 1 ? '(CONTINUED)' : ''}</h3>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #5f6578; color: white;">
              <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Code</th>
              ${showIcd10 ? '<th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">ICD-10</th>' : ''}
              <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Description</th>
              <th style="padding: 12px 10px; text-align: center; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Qty</th>
              <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Unit Price</th>
              <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Med Aid</th>
              <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${pageServices.map((service, index) => `
              <tr style="border-bottom: 1px solid #f3f4f6; ${index % 2 === 1 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #1f2937; font-size: 11px;">${present(service.code) ? escapeHtml(service.code) : 'N/A'}</td>
                ${showIcd10 ? `<td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-size: 11px; color: #4b5563;">${escapeHtml((service.icd10 ?? []).filter(present).join(', '))}</td>` : ''}
                <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-size: 11px;">
                  <div style="color: #4b5563;">${escapeHtml(service.description)}</div>
                </td>
                <td style="padding: 12px 10px; text-align: center; border-right: 1px solid #e5e7eb; font-size: 11px;">${escapeHtml(service.quantity)}</td>
                <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; font-size: 11px;">${nad(Number(service.unitPrice) || 0)}</td>
                <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px;">${nad(Number(service.medicalAid) || 0)}</td>
                <td style="padding: 12px 10px; text-align: right; font-weight: 600; color: #1f2937; font-size: 11px;">${nad(Number(service.total) || 0)}</td>
              </tr>
            `).join('')}

            ${isLastPage ? `
            <!-- Summary Rows -->
            <tr>
              <td colspan="${labelColumns}" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; border-right: 1px solid #e5e7eb; font-size: 11px;">Subtotal:</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; font-size: 11px;">${nad(fromCents(subtotalCents))}</td>
            </tr>
            ${vat && vat.vatCents !== 0 ? `
            <!-- Tax invoice: the VAT inside the prices (VAT-registered practice) -->
            <tr>
              <td colspan="${labelColumns}" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; border-right: 1px solid #e5e7eb; font-size: 11px;">Total excluding VAT:</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; font-size: 11px;">${nad(fromCents(vat.exclVatCents))}</td>
            </tr>
            <tr>
              <td colspan="${labelColumns}" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; border-right: 1px solid #e5e7eb; font-size: 11px;">${escapeHtml(vatRateLabel(vat.rates))} included:</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; font-size: 11px;">${nad(fromCents(vat.vatCents))}</td>
            </tr>
            ` : ''}

            <!-- Patient Portion Row -->
            <tr>
              <td colspan="${labelColumns}" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; border-right: 1px solid #fed7aa; font-size: 11px; color: #ea580c;">Patient Portion:</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; font-size: 11px; color: #ea580c;">${nad(fromCents(totalCents - medicalAidCents))}</td>
            </tr>

            <!-- Total Row -->
            <tr>
              <td colspan="${labelColumns}" style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; background: #5f6578; color: white; border-right: 1px solid #5f6578; text-transform: uppercase;">${receipt ? 'Amount Paid:' : 'Total Amount Due:'}</td>
              <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 14px; background: #5f6578; color: white;">${nad(fromCents(totalCents))}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      ${isLastPage ? `
      <!-- Compact Banking Details Section -->
      <div style="margin-bottom: 20px; padding: 10px 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb;">
        <h3 style="font-size: 10px; font-weight: 600; color: #5f6578; margin: 0 0 6px 0; text-transform: uppercase;">Banking Details</h3>
        <div style="display: flex; gap: 20px; font-size: 10px; line-height: 1.3;">
          <span style="color: #6b7280;">Bank: <strong style="color: #1f2937;">${escapeHtml(practice.bankName ?? '')}</strong></span>
          <span style="color: #6b7280;">Account: <strong style="color: #1f2937;">${escapeHtml(practice.accountNumber ?? '')}</strong></span>
          <span style="color: #6b7280;">Branch: <strong style="color: #1f2937;">${escapeHtml(practice.branchCode ?? '')}</strong></span>
        </div>
      </div>

      <!-- Professional Footer -->
      <div style="padding: 15px 0; border-top: 1px solid #e5e7eb; margin-top: 30px;">
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 9px; color: #6b7280; line-height: 1.5;">
            ${receipt ? '' : 'Payment is due within 30 days. '}Thank you for choosing <strong style="color: #374151;">${escapeHtml(practice.name)}</strong>${contact ? ` For inquiries: ${contact}` : ''}
          </p>
          <div style="margin-top: 12px; font-size: 8px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 8px;">
            ${receipt ? 'Receipt' : 'Invoice'} generated by <strong style="color: #6b7280;">OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Page number at bottom -->
      <div style="position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 8px; color: #9ca3af;">
        Page ${pageNumber} of ${totalPages}
      </div>
    </div>
  `;
}

/** Every page of the owner's invoice or receipt, as HTML */
export function ownerInvoicePages(print: OwnerInvoicePrint): string[] {
  const chunks = paginateOwnerInvoiceServices(print.services);
  return chunks.map((services, index) => ownerInvoicePageHtml(print, services, index + 1, chunks.length, index === chunks.length - 1));
}

/** The file name the owner's invoice downloads as */
export const ownerInvoiceFileName = (print: Pick<OwnerInvoicePrint, 'kind' | 'invoiceNumber'>): string =>
  `${print.kind === 'receipt' ? 'receipt' : 'invoice'}-${print.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;

const FONTS_LINK_ID = 'owner-print-fonts';

/**
 * Draws the pages into an A4 PDF the way the owner's code did: each page pictured off screen at twice its size
 * (html2canvas) and placed full width on its own PDF page. The fonts it was designed in (Montserrat, Rubik) are loaded first.
 */
export async function renderOwnerInvoicePdf(pages: readonly string[]): Promise<jsPDF> {
  // Loaded on demand so the PDF libraries are not downloaded with the first screen. The app also carries the old jsPDF 1.x
  // typings (@types/jspdf), which hide jsPDF 3's named export from a dynamic import's type; at run time the class is
  // exported by name, as jsPDF 3's own typings (the type import above) say.
  const [{ default: html2canvas }, pdfLibrary] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const JsPdf = (pdfLibrary as unknown as { jsPDF: typeof jsPDF }).jsPDF;
  if (!document.getElementById(FONTS_LINK_ID)) {
    const fontLink = document.createElement('link');
    fontLink.id = FONTS_LINK_ID;
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }
  await document.fonts?.ready;

  const pdf = new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  for (let index = 0; index < pages.length; index++) {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);
    try {
      container.innerHTML = pages[index];
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, (canvas.height * pdfWidth) / canvas.width, '', 'FAST');
    } finally {
      container.remove();
    }
  }
  return pdf;
}
