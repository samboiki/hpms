import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DocumentGenerationOptions {
  visitId: string;
  patientId: string;
  practiceId: string;
  documents: ('prescription' | 'leave_form' | 'invoice')[];
}

interface GeneratedDocument {
  type: 'prescription' | 'leave_form' | 'invoice';
  documentName: string;
  filePath: string;
  fileSize: number;
  publicUrl?: string;
}

export class DocumentGenerationService {
  /**
   * Generate all requested documents for a visit
   * Robust implementation with comprehensive error handling
   */
  async generateVisitDocuments(options: DocumentGenerationOptions): Promise<GeneratedDocument[]> {
    console.log('📄 Starting document generation for visit:', options.visitId);
    const generatedDocuments: GeneratedDocument[] = [];

    // Validate required parameters
    if (!options.visitId || !options.patientId || !options.practiceId) {
      console.error('❌ Document generation validation failed:', {
        visitId: !!options.visitId,
        patientId: !!options.patientId,
        practiceId: !!options.practiceId
      });
      throw new Error('Missing required parameters for document generation');
    }

    try {
      // First check if we have prescription data for this visit
      const { data: medications } = await supabase
        .from('medications')
        .select('*')
        .eq('visit_id', options.visitId);

      const hasPrescription = medications && medications.length > 0;

      // Check if we have leave form data
      const { data: leaveForm } = await (supabase as any)
        .from('leave_forms')
        .select('*')
        .eq('visit_id', options.visitId)
        .maybeSingle();

      const hasLeaveForm = !!leaveForm;

      // Check if we have invoice data
      const { data: invoice } = await supabase
        .from('invoices_enhanced')
        .select(`
          *,
          invoice_services (*)
        `)
        .eq('visit_id', options.visitId)
        .maybeSingle();

      const hasInvoice = invoice && invoice.invoice_services && invoice.invoice_services.length > 0;

      // Fetch visit data with all related information
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .select(`
          *,
          patients!visits_patient_id_fkey (
            id, first_name, last_name, date_of_birth, 
            cell_number, email, home_address, gender
          ),
          users!visits_doctor_id_fkey (
            id, full_name, email, role, signature_url
          )
        `)
        .eq('id', options.visitId)
        .single();

      if (visitError || !visit) {
        console.error('Failed to fetch visit data:', visitError);
        throw new Error('Failed to fetch visit data');
      }

      // Fetch practice data with all details
      const { data: practice, error: practiceError } = await supabase
        .from('practices')
        .select(`
          id, name, slug, domain, logo_url, primary_color, secondary_color,
          contact_email, contact_phone, address, city, country, postal_code,
          tax_number, license_number, practice_number, hero_subtitle,
          bank_name, account_holder_name, account_number, branch_code, swift_code, account_type
        `)
        .eq('id', options.practiceId)
        .single();

      if (practiceError || !practice) {
        throw new Error('Failed to fetch practice data');
      }

      // Fetch medical aid details for the patient if available
      let medicalAid = null;
      if (visit.patients?.id) {
        try {
          // First try to get primary medical aid
          const { data: primaryMedicalAid, error: primaryError } = await supabase
            .from('medical_aid_details')
            .select(`
              *,
              medical_aid_providers (
                name, short_name
              )
            `)
            .eq('patient_id', visit.patients.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (primaryMedicalAid && !primaryError) {
            medicalAid = primaryMedicalAid;
          } else {
            // If no primary, get any medical aid for this patient
            const { data: anyMedicalAid, error: anyError } = await supabase
              .from('medical_aid_details')
              .select(`
                *,
                medical_aid_providers (
                  name, short_name
                )
              `)
              .eq('patient_id', visit.patients.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
              
            if (anyMedicalAid && !anyError) {
              medicalAid = anyMedicalAid;
            }
          }
        } catch (error) {
          console.log('Note: Could not fetch medical aid details - table might not have is_primary column:', error);
          // Continue without medical aid data - non-critical for document generation
        }
      }

      // Generate each requested document only if data exists
      // Process documents concurrently for better performance
      const documentPromises = options.documents.map(async (docType) => {
        console.log(`📄 Checking if we should generate ${docType} for visit ${options.visitId}`);
        
        try {
          let generatedDoc: GeneratedDocument | null = null;

          switch (docType) {
            case 'prescription':
              if (hasPrescription) {
                generatedDoc = await this.generatePrescription(visit, practice, medications, medicalAid);
              } else {
                console.log('ℹ️ Skipping prescription - no medications found');
              }
              break;
            case 'leave_form':
              if (hasLeaveForm) {
                generatedDoc = await this.generateLeaveForm(visit, practice, leaveForm, medicalAid);
              } else {
                console.log('ℹ️ Skipping leave form - no leave form data found');
              }
              break;
            case 'invoice':
              if (hasInvoice) {
                generatedDoc = await this.generateInvoice(visit, practice, invoice, medicalAid);
              } else {
                console.log('ℹ️ Skipping invoice - no invoice data found');
              }
              break;
          }

          if (generatedDoc) {
            // Save document reference to database
            try {
              await this.saveDocumentReference({
                visitId: options.visitId,
                patientId: options.patientId,
                practiceId: options.practiceId,
                ...generatedDoc
              });
              return generatedDoc;
            } catch (saveError) {
              console.error(`⚠️ Warning: Failed to save document reference for ${docType}:`, saveError);
              // Still return the generated document even if saving reference failed
              return generatedDoc;
            }
          }
          return null;
        } catch (error) {
          console.error(`❌ Error generating ${docType}:`, error);
          // Continue with other documents even if one fails
          return null;
        }
      });

      // Wait for all documents to be generated
      const results = await Promise.all(documentPromises);
      
      // Filter out null results
      for (const doc of results) {
        if (doc) {
          generatedDocuments.push(doc);
        }
      }

      console.log('✅ Document generation completed:', generatedDocuments.length, 'documents');
      return generatedDocuments;
    } catch (error) {
      console.error('❌ Error generating documents:', error);
      throw error;
    }
  }

  /**
   * Generate prescription PDF
   */
  private async generatePrescription(visit: any, practice: any, medications: any[], medicalAid?: any): Promise<GeneratedDocument | null> {
    try {
      // Check if we have medications
      if (!medications || medications.length === 0) {
        console.log('ℹ️ No medications for this visit');
        return null;
      }

      console.log('🎯 Starting prescription PDF generation with', medications.length, 'medications');
      
      // Load fonts first
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
      await document.fonts.ready;
      
      // Create HTML content for prescription
      const html = this.createPrescriptionHTML(visit, practice, medications, medicalAid);
      
      // Generate PDF - A5 format for prescriptions
      const pdfBlob = await this.htmlToPDF(html, 'a5');
      
      // Upload to storage
      const fileName = `prescription_${visit.id}_${Date.now()}.pdf`;
      const filePath = await this.uploadToStorage(pdfBlob, fileName, 'prescriptions');
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      return {
        type: 'prescription',
        documentName: `Prescription - ${format(new Date(), 'dd/MM/yyyy')}`,
        filePath,
        fileSize: pdfBlob.size,
        publicUrl
      };
    } catch (error) {
      console.error('Error generating prescription:', error);
      return null;
    }
  }

  /**
   * Generate leave form PDF
   */
  private async generateLeaveForm(visit: any, practice: any, leaveForm: any, medicalAid: any): Promise<GeneratedDocument | null> {
    try {
      if (!leaveForm) {
        console.log('ℹ️ No leave form data provided');
        return null;
      }

      console.log('🎯 Starting leave form PDF generation');
      
      // Load fonts first
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
      await document.fonts.ready;

      // Create HTML content for leave form
      const html = this.createLeaveFormHTML(visit, practice, leaveForm, medicalAid);
      
      // Generate PDF - A5 format for leave forms
      const pdfBlob = await this.htmlToPDF(html, 'a5');
      
      // Upload to storage
      const fileName = `leave_form_${leaveForm.form_number || visit.id}_${Date.now()}.pdf`;
      const filePath = await this.uploadToStorage(pdfBlob, fileName, 'leave_forms');
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      return {
        type: 'leave_form',
        documentName: `Leave Form - ${leaveForm.form_number || format(new Date(), 'dd/MM/yyyy')}`,
        filePath,
        fileSize: pdfBlob.size,
        publicUrl
      };
    } catch (error) {
      console.error('Error generating leave form:', error);
      return null;
    }
  }

  /**
   * Generate invoice PDF - using the beautiful styling from ComprehensivePatientModal
   */
  private async generateInvoice(visit: any, practice: any, invoice: any, medicalAid: any): Promise<GeneratedDocument | null> {
    try {
      if (!invoice || !invoice?.invoice_services || invoice.invoice_services.length === 0) {
        console.log('ℹ️ No invoice data provided');
        return null;
      }

      console.log('🎯 Starting invoice PDF generation for invoice:', invoice.invoice_number);
      
      // Load fonts first
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
      await document.fonts.ready;

      // Get medical aid provider name if available
      let medicalAidProviderName = 'N/A';
      if (medicalAid?.medical_aid_providers) {
        medicalAidProviderName = medicalAid.medical_aid_providers.short_name || medicalAid.medical_aid_providers.name;
      }

      // Create patient info object
      const patientInfo = {
        name: `${visit.patients.first_name} ${visit.patients.last_name}`,
        phone: visit.patients.cell_number || undefined,
        email: visit.patients.email || undefined,
        address: visit.patients.home_address || undefined,
        medicalAidProvider: medicalAidProviderName,
        membershipNumber: medicalAid?.membership_number,
      };

      // Create HTML content for invoice using the beautiful styling
      const html = await this.createInvoiceHTMLWithBeautifulStyling(visit, practice, invoice, patientInfo, medicalAid, medicalAidProviderName);
      
      // Generate PDF - A4 format for invoices
      const pdfBlob = await this.htmlToPDF(html, 'a4');
      
      // Upload to storage
      const fileName = `invoice_${invoice.invoice_number || 'unknown'}_${Date.now()}.pdf`;
      const filePath = await this.uploadToStorage(pdfBlob, fileName, 'invoices');
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      return {
        type: 'invoice',
        documentName: `Invoice - ${invoice.invoice_number || 'N/A'}`,
        filePath,
        fileSize: pdfBlob.size,
        publicUrl
      };
    } catch (error) {
      console.error('Error generating invoice:', error);
      return null;
    }
  }

  /**
   * Create prescription HTML with beautiful styling matching the invoice style
   */
  private createPrescriptionHTML(visit: any, practice: any, medications: any[], medicalAid?: any): string {
    const patient = visit.patients;
    const doctor = visit.users;
    const logoUrl = practice.logo_url || '';
    const primaryColor = practice.primary_color || '#5f6578';
    
    // Helper functions for color manipulation
    function hexToRgb(hex: string) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [95, 101, 120];
    }
    
    function adjustBrightness(hex: string, percent: number) {
      const [r, g, b] = hexToRgb(hex);
      const adjust = (color: number) => Math.max(0, Math.min(255, Math.round(color * (1 + percent / 100))));
      return `#${((1 << 24) + (adjust(r) << 16) + (adjust(g) << 8) + adjust(b)).toString(16).slice(1)}`;
    }
    
    const lightColor = adjustBrightness(primaryColor, 20);
    const darkColor = adjustBrightness(primaryColor, -15);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Montserrat', sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #2c2c2c;
            background-color: #ffffff;
            margin: 0;
          }
          
          .prescription-container {
            width: 595px; /* A5 in points */
            height: 842px;
            padding: 20px;
            margin: 0 auto;
            background: white;
            position: relative;
          }
          
          /* Premium Header Section */
          .header {
            padding: 0;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          
          .logo-section {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            flex: 1;
          }
          
          .logo {
            width: 100px;
            height: auto;
            max-height: 50px;
            border-radius: 6px;
            object-fit: contain;
          }
          
          .practice-name {
            font-family: 'Rubik', sans-serif;
            font-size: 18px;
            font-weight: 800;
            color: #5f6578;
            letter-spacing: -0.2px;
          }
          
          .practice-details {
            text-align: right;
            flex: 1;
            max-width: 250px;
            font-size: 9px;
            line-height: 1.6;
            color: #5a5a5a;
            font-weight: 400;
          }
          
          /* Prescription Title Section */
          .title-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px 0;
            border-bottom: 2px solid #d1d5db;
          }
          
          .rx-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .rx-symbol {
            font-size: 28px;
            font-weight: 700;
            color: ${primaryColor};
          }
          
          .prescription-title {
            font-family: 'Rubik', sans-serif;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #5f6578;
          }
          
          .prescription-number {
            font-size: 10px;
            font-weight: 600;
            color: #666;
            letter-spacing: 0.3px;
          }
          
          .date-info {
            display: flex;
            align-items: center;
            gap: 15px;
            font-size: 9px;
            color: #666;
          }
          
          .date-box {
            text-align: center;
          }
          
          .date-label {
            color: #aaa;
            text-transform: uppercase;
            margin-bottom: 3px;
            font-size: 7px;
            font-weight: 600;
            letter-spacing: 0.8px;
          }
          
          .date-value {
            font-weight: 700;
            color: #2c2c2c;
            font-size: 10px;
          }
          
          /* Patient Info Section */
          .patient-section {
            margin-bottom: 20px;
          }
          
          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: ${primaryColor};
            margin: 0 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .patient-info {
            display: flex;
            justify-content: space-between;
            gap: 25px;
          }
          
          .patient-details {
            flex: 1;
            line-height: 1.4;
          }
          
          .patient-name {
            font-weight: 700;
            font-size: 12px;
            color: #1a1a1a;
            margin-bottom: 3px;
          }
          
          .patient-detail-line {
            color: #666;
            margin-bottom: 2px;
            font-size: 9px;
          }
          
          /* Medications Section */
          .medications-section {
            margin-bottom: 30px;
          }
          
          .medications-title {
            font-size: 14px;
            font-weight: 700;
            color: #5f6578;
            margin: 0 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #d1d5db;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .medications-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .medications-table thead {
            background: #5f6578;
            color: white;
          }
          
          .medications-table th {
            padding: 8px;
            text-align: left;
            font-weight: 600;
            font-size: 10px;
            border-right: 1px solid rgba(255,255,255,0.3);
            text-transform: uppercase;
          }
          
          .medications-table th:last-child {
            border-right: none;
          }
          
          .medications-table tbody tr {
            border-bottom: 1px solid #f3f4f6;
          }
          
          .medications-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .medications-table td {
            padding: 6px 8px;
            border-right: 1px solid #e5e7eb;
            font-size: 10px;
            vertical-align: middle;
          }
          
          .medications-table td:last-child {
            border-right: none;
          }
          
          .medication-name {
            font-weight: 600;
            color: #1f2937;
          }
          
          /* Diagnosis Section */
          .diagnosis-section {
            margin-bottom: 20px;
            padding: 12px 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          
          .diagnosis-title {
            font-size: 10px;
            font-weight: 600;
            color: ${primaryColor};
            margin: 0 0 6px 0;
            text-transform: uppercase;
          }
          
          .diagnosis-text {
            font-size: 10px;
            line-height: 1.4;
            color: #4b5563;
          }
          
          /* Footer Section */
          .footer {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
          }
          
          .signature-section {
            display: flex;
            justify-content: space-between;
            gap: 40px;
            margin-bottom: 20px;
          }
          
          .signature-box {
            flex: 1;
            text-align: center;
          }
          
          .signature-line {
            border-bottom: 1px solid #999;
            height: 40px;
            margin-bottom: 5px;
          }
          
          .signature-label {
            font-size: 9px;
            color: #666;
            line-height: 1.3;
          }
          
          .footer-info {
            text-align: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
          }
          
          .footer-text {
            font-size: 8px;
            color: #6b7280;
            line-height: 1.5;
          }
          
          .footer-brand {
            margin-top: 8px;
            font-size: 7px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
            padding-top: 6px;
          }
          
          /* Watermark removed */
        </style>
      </head>
      <body>
        <div class="prescription-container">
          
          <!-- Premium Header Section -->
          <div class="header">
            <div class="logo-section">
              ${logoUrl ? `<img src="${logoUrl}" alt="Practice Logo" class="logo">` : ''}
              <div class="practice-name">${practice.name}</div>
            </div>
            
            <div class="practice-details">
              ${practice.address ? `<div>${practice.address}</div>` : ''}
              <div>${practice.city || ''}, ${practice.country || ''} ${practice.postal_code || ''}</div>
              ${practice.contact_phone ? `<div>Tel: ${practice.contact_phone}</div>` : ''}
              ${practice.contact_email ? `<div>Email: ${practice.contact_email}</div>` : ''}
              ${practice.practice_number ? `<div>Practice No: ${practice.practice_number}</div>` : ''}
            </div>
          </div>
          
          <!-- Title Section -->
          <div class="title-section">
            <div class="rx-title">
              <span class="prescription-title">MEDICAL PRESCRIPTION</span>
              <span class="prescription-number">#RX-${visit.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div class="date-info">
              <div class="date-box">
                <div class="date-label">DATE ISSUED</div>
                <div class="date-value">${format(new Date(), 'dd MMM yyyy')}</div>
              </div>
            </div>
          </div>
          
          <!-- PREPARED FOR Section - Matching Leave Form Style -->
          <div class="patient-section">
            <h3 class="section-title">PREPARED FOR</h3>
            <div class="patient-info">
              <div class="patient-details">
                <div class="patient-name">${patient.first_name} ${patient.last_name}</div>
                ${patient.cell_number ? `<div class="patient-detail-line">${patient.cell_number}</div>` : ''}
                ${patient.email ? `<div class="patient-detail-line">${patient.email}</div>` : ''}
                ${patient.home_address ? `<div class="patient-detail-line">${patient.home_address}</div>` : ''}
              </div>
              
              <div class="patient-details" style="text-align: right;">
                <div class="patient-name">${medicalAid?.medical_aid_providers?.short_name || medicalAid?.medical_aid_providers?.name || 'N/A'}</div>
                <div class="patient-detail-line">Scheme: ${medicalAid?.scheme || 'N/A'}</div>
                <div class="patient-detail-line">Member: ${medicalAid?.membership_number || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <!-- Medications Table -->
          <div class="medications-section">
            <h3 class="medications-title">PRESCRIBED MEDICATIONS</h3>
            <table class="medications-table">
              <thead>
                <tr>
                  <th style="width: 30%">Medication</th>
                  <th style="width: 15%">Dosage</th>
                  <th style="width: 15%">Frequency</th>
                  <th style="width: 15%">Duration</th>
                  <th style="width: 25%">Instructions</th>
                </tr>
              </thead>
              <tbody>
                ${medications.map((med: any) => `
                  <tr>
                    <td class="medication-name">${med.medication_name || 'N/A'}</td>
                    <td>${med.dosage || 'As directed'}</td>
                    <td>${med.frequency || 'As directed'}</td>
                    <td>${med.duration || 'As directed'}</td>
                    <td>${med.instructions || 'Take as directed by physician'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          
          <!-- Footer -->
          <div class="footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Patient Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">
                  ${doctor?.signature_url ? `<img src="${doctor.signature_url}" alt="Doctor Signature" style="max-height: 35px; margin-top: 5px; object-fit: contain;">` : ''}
                </div>
                <div class="signature-label">
                  ${doctor?.full_name || 'Doctor'}<br>
                  Prescribing Physician
                </div>
              </div>
            </div>
            
            <div class="footer-info">
              <p class="footer-text">
                This prescription is valid for 30 days from the date of issue.<br>
                For inquiries: ${practice.contact_phone || ''} • ${practice.contact_email || ''}
              </p>
              <div class="footer-brand">
                Prescription generated by <strong>OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Calculate days between two dates
   */
  private calculateDays(fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }

  /**
   * Create leave form HTML with beautiful styling
   */
  private createLeaveFormHTML(visit: any, practice: any, leaveForm: any, medicalAid: any): string {
    const patient = visit.patients;
    const doctor = visit.users;
    const logoUrl = practice.logo_url || '';
    const primaryColor = practice.primary_color || '#5f6578';
    
    // Get medical aid provider name
    let medicalAidName = '';
    if (medicalAid?.medical_aid_providers) {
      medicalAidName = medicalAid.medical_aid_providers.short_name || medicalAid.medical_aid_providers.name;
    }
    
    // Helper function to convert number to words
    const numberToWords = (num: number): string => {
      const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
      const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
      const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      
      if (num === 0) return 'zero';
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) {
        const ten = Math.floor(num / 10);
        const one = num % 10;
        return tens[ten] + (one ? '-' + ones[one] : '');
      }
      return num.toString(); // fallback for larger numbers
    };
    
    // Helper functions for color manipulation
    function hexToRgb(hex: string) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [95, 101, 120];
    }
    
    function adjustBrightness(hex: string, percent: number) {
      const [r, g, b] = hexToRgb(hex);
      const adjust = (color: number) => Math.max(0, Math.min(255, Math.round(color * (1 + percent / 100))));
      return `#${((1 << 24) + (adjust(r) << 16) + (adjust(g) << 8) + adjust(b)).toString(16).slice(1)}`;
    }
    
    const lightColor = adjustBrightness(primaryColor, 20);
    const darkColor = adjustBrightness(primaryColor, -15);
    
    // Calculate leave duration
    const fromDate = new Date(leaveForm.from_date);
    const toDate = new Date(leaveForm.to_date);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Montserrat', sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #2c2c2c;
            background-color: #ffffff;
            margin: 0;
          }
          
          .leave-container {
            width: 595px; /* A5 in points */
            height: 842px;
            padding: 20px;
            margin: 0 auto;
            background: white;
            position: relative;
          }
          
          /* Premium Header Section */
          .header {
            padding: 0;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          
          .logo-section {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            flex: 1;
          }
          
          .logo {
            width: 100px;
            height: auto;
            max-height: 50px;
            border-radius: 6px;
            object-fit: contain;
          }
          
          .practice-name {
            font-family: 'Rubik', sans-serif;
            font-size: 18px;
            font-weight: 800;
            color: #5f6578;
            letter-spacing: -0.2px;
          }
          
          .practice-details {
            text-align: right;
            flex: 1;
            max-width: 250px;
            font-size: 9px;
            line-height: 1.6;
            color: #5a5a5a;
            font-weight: 400;
          }
          
          /* Certificate Title Section */
          .title-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px 0;
            border-bottom: 2px solid #d1d5db;
          }
          
          .cert-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .cert-icon {
            width: 32px;
            height: 32px;
            background: ${lightColor};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: ${primaryColor};
          }
          
          .certificate-title {
            font-family: 'Rubik', sans-serif;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #5f6578;
            text-transform: uppercase;
          }
          
          .certificate-number {
            font-size: 10px;
            font-weight: 600;
            color: #666;
            letter-spacing: 0.3px;
          }
          
          .date-info {
            display: flex;
            align-items: center;
            gap: 15px;
            font-size: 9px;
            color: #666;
          }
          
          .date-box {
            text-align: center;
          }
          
          .date-label {
            color: #aaa;
            text-transform: uppercase;
            margin-bottom: 3px;
            font-size: 7px;
            font-weight: 600;
            letter-spacing: 0.8px;
          }
          
          .date-value {
            font-weight: 700;
            color: #2c2c2c;
            font-size: 10px;
          }
          
          /* PREPARED FOR Section - Exactly Matching Invoice Style */
          .patient-section {
            margin-bottom: 20px;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #5f6578;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .patient-info {
            display: flex;
            justify-content: space-between;
            gap: 25px;
          }
          
          .patient-details {
            flex: 1;
            line-height: 1.4;
          }
          
          .patient-name {
            font-weight: 700;
            font-size: 12px;
            color: #1a1a1a;
            margin-bottom: 3px;
          }
          
          .patient-contact {
            color: #666;
            margin-bottom: 2px;
            font-size: 9px;
          }
          
          /* Certification Section - Clean Design */
          .certification-section {
            margin-bottom: 20px;
          }
          
          .certification-header {
            font-size: 14px;
            font-weight: 700;
            color: #5f6578;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .certification-text {
            font-size: 11px;
            line-height: 1.6;
            color: #333;
            margin-bottom: 12px;
          }
          
          .diagnosis-info {
            margin-top: 8px;
          }
          
          .diagnosis-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          
          .diagnosis-value {
            font-weight: 600;
            color: #1a1a1a;
            font-size: 11px;
          }
          
          /* Leave Period Section - Compact with Grey Background */
          .leave-period-section {
            margin-bottom: 20px;
          }
          
          .leave-period-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
          }
          
          .period-item {
            text-align: center;
          }
          
          .period-label {
            font-size: 8px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          
          .period-value {
            font-weight: 700;
            font-size: 13px;
            color: #1a1a1a;
          }
          
          .period-date {
            font-size: 9px;
            color: #666;
            margin-top: 1px;
          }
          
          /* Removed fitness status styles */
          
          /* Restrictions Section */
          .restrictions-section {
            margin-bottom: 20px;
            padding: 12px 15px;
            background: #fff7ed;
            border-radius: 6px;
            border: 1px solid #fed7aa;
          }
          
          .restrictions-title {
            font-size: 10px;
            font-weight: 600;
            color: #ea580c;
            margin: 0 0 6px 0;
            text-transform: uppercase;
          }
          
          .restrictions-text {
            font-size: 10px;
            line-height: 1.4;
            color: #7c2d12;
          }
          
          /* Footer Section */
          .footer {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
          }
          
          .signature-section {
            display: flex;
            justify-content: space-between;
            gap: 40px;
            margin-bottom: 20px;
          }
          
          .signature-box {
            flex: 1;
            text-align: center;
          }
          
          .signature-line {
            border-bottom: 1px solid #999;
            height: 40px;
            margin-bottom: 5px;
          }
          
          .signature-label {
            font-size: 9px;
            color: #666;
            line-height: 1.3;
          }
          
          .footer-info {
            text-align: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
          }
          
          .footer-text {
            font-size: 8px;
            color: #6b7280;
            line-height: 1.5;
          }
          
          .footer-brand {
            margin-top: 8px;
            font-size: 7px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
            padding-top: 6px;
          }
          
          /* Removed watermark styles */
        </style>
      </head>
      <body>
        <div class="leave-container">
          
          <!-- Premium Header Section -->
          <div class="header">
            <div class="logo-section">
              ${logoUrl ? `<img src="${logoUrl}" alt="Practice Logo" class="logo">` : ''}
              <div class="practice-name">${practice.name}</div>
            </div>
            
            <div class="practice-details">
              ${practice.address ? `<div>${practice.address}</div>` : ''}
              <div>${practice.city || ''}, ${practice.country || ''} ${practice.postal_code || ''}</div>
              ${practice.contact_phone ? `<div>Tel: ${practice.contact_phone}</div>` : ''}
              ${practice.contact_email ? `<div>Email: ${practice.contact_email}</div>` : ''}
              ${practice.practice_number ? `<div>Practice No: ${practice.practice_number}</div>` : ''}
            </div>
          </div>
          
          <!-- Title Section -->
          <div class="title-section">
            <div class="cert-title">
              <span class="certificate-title">MEDICAL CERTIFICATE</span>
              <span class="certificate-number">${leaveForm.form_number ? `#${leaveForm.form_number}` : `#MC-${visit.id.substring(0, 8).toUpperCase()}`}</span>
            </div>
            <div class="date-info">
              <div class="date-box">
                <div class="date-label">DATE ISSUED</div>
                <div class="date-value">${format(new Date(), 'dd MMM yyyy')}</div>
              </div>
            </div>
          </div>
          
          <!-- PREPARED FOR Section - Exactly Matching Invoice Style -->
          <div class="patient-section">
            <h3 class="section-title">PREPARED FOR</h3>
            <div class="patient-info">
              <div class="patient-details">
                <div class="patient-name">${patient.first_name} ${patient.last_name}</div>
                ${patient.cell_number ? `<div class="patient-contact">${patient.cell_number}</div>` : ''}
                ${patient.email ? `<div class="patient-contact">${patient.email}</div>` : ''}
                ${patient.home_address ? `<div class="patient-contact">${patient.home_address}</div>` : ''}
              </div>
              
              <div class="patient-details" style="text-align: right;">
                <div class="patient-name">${medicalAidName || 'N/A'}</div>
                <div class="patient-contact">Scheme: ${medicalAid?.scheme || 'N/A'}</div>
                <div class="patient-contact">Member: ${medicalAid?.membership_number || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <!-- Medical Justification for Absence Section -->
          <div class="certification-section">
            <h3 class="certification-header">MEDICAL JUSTIFICATION FOR ABSENCE</h3>
            <div class="certification-text">
              This letter serves to certify that the patient, <strong>${patient.first_name} ${patient.last_name}</strong>, was examined and treated at our facility on <strong>${format(new Date(visit.visit_date || visit.created_at), 'dd MMMM yyyy')}</strong>.
              <br><br>
              Based on my medical assessment, the patient was found to be medically unfit for duty.
              <br><br>
              Therefore, I have recommended <strong>${numberToWords(daysDiff)}</strong> (<strong>${daysDiff}</strong>) ${daysDiff === 1 ? 'day' : 'days'} of sick leave, effective for the period of <strong>${format(fromDate, 'dd MMMM yyyy')}</strong>. The patient is expected to be fit to resume normal duties from <strong>${format(new Date(toDate.getTime() + 24 * 60 * 60 * 1000), 'dd MMMM yyyy')}</strong>.
            </div>
            ${leaveForm.diagnosis ? `
              <div class="diagnosis-info">
                <div class="diagnosis-label">Medical Findings</div>
                <div class="diagnosis-value">
                  ${leaveForm.diagnosis}
                  ${leaveForm.diagnosis_code ? ` (ICD-10: ${leaveForm.diagnosis_code})` : ''}
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- Leave Period -->
          <div class="leave-period-section">
            <h3 class="section-title">MEDICAL LEAVE PERIOD</h3>
            <div class="leave-period-grid">
              <div class="period-item">
                <div class="period-label">From Date</div>
                <div class="period-value">${format(fromDate, 'dd MMM')}</div>
                <div class="period-date">${format(fromDate, 'yyyy')}</div>
              </div>
              <div class="period-item">
                <div class="period-label">To Date</div>
                <div class="period-value">${format(toDate, 'dd MMM')}</div>
                <div class="period-date">${format(toDate, 'yyyy')}</div>
              </div>
              <div class="period-item">
                <div class="period-label">Total Days</div>
                <div class="period-value">${daysDiff}</div>
                <div class="period-date">day${daysDiff > 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
          
          
          ${leaveForm.restrictions ? `
            <div class="restrictions-section">
              <h3 class="restrictions-title">Restrictions/Limitations</h3>
              <div class="restrictions-text">${leaveForm.restrictions}</div>
            </div>
          ` : ''}
          
          ${leaveForm.follow_up_required && leaveForm.follow_up_date ? `
            <div class="restrictions-section">
              <h3 class="restrictions-title">Follow-up Required</h3>
              <div class="restrictions-text">
                Patient must return for follow-up consultation on: <strong>${format(new Date(leaveForm.follow_up_date), 'dd MMMM yyyy')}</strong>
              </div>
            </div>
          ` : ''}
          
          <!-- Footer -->
          <div class="footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Patient Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">
                  ${doctor?.signature_url ? `<img src="${doctor.signature_url}" alt="Doctor Signature" style="max-height: 35px; margin-top: 5px; object-fit: contain;">` : ''}
                </div>
                <div class="signature-label">
                  ${doctor?.full_name || 'Doctor'}<br>
                  Prescribing Physician
                </div>
              </div>
            </div>
            
            <div class="footer-info">
              <p class="footer-text">
                This certificate is issued in accordance with medical examination findings.<br>
                For verification: ${practice.contact_phone || ''} • ${practice.contact_email || ''}
              </p>
              <div class="footer-brand">
                Certificate generated by <strong>OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create invoice HTML using the beautiful styling from ComprehensivePatientModal
   */
  private async createInvoiceHTMLWithBeautifulStyling(visit: any, practice: any, invoice: any, patientInfo: any, medicalAid: any, medicalAidProviderName: string): Promise<string> {
    // Ensure services is always an array
    const services = Array.isArray(invoice?.invoice_services) ? invoice.invoice_services : [];
    const primaryColor = practice.primary_color || '#01b9d4';
    
    // Helper functions for color manipulation
    function hexToRgb(hex: string) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [1, 185, 212];
    }
    
    function adjustBrightness(hex: string, percent: number) {
      const [r, g, b] = hexToRgb(hex);
      const adjust = (color: number) => Math.max(0, Math.min(255, Math.round(color * (1 + percent / 100))));
      return `#${((1 << 24) + (adjust(r) << 16) + (adjust(g) << 8) + adjust(b)).toString(16).slice(1)}`;
    }
    
    const lightColor = adjustBrightness(primaryColor, 20);
    const darkColor = adjustBrightness(primaryColor, -15);
    
    // Calculate totals for the invoice
    const calculateSubtotal = (services: any[]) => {
      if (!Array.isArray(services) || services.length === 0) return 0;
      return services.reduce((sum: number, s: any) => sum + (parseFloat(s?.total_price) || 0), 0);
    };
    
    const subtotal = calculateSubtotal(services);
    const patientPortion = (invoice.total || 0) - (invoice.medical_aid_covered || 0);
    
    // Create function to generate page HTML with beautiful styling
    const createPageHTML = (pageServices: any[], pageNumber: number, totalPages: number, isLastPage: boolean) => {
      // Recalculate subtotal for safety
      const pageSubtotal = isLastPage ? subtotal : calculateSubtotal(pageServices);
      const safePatientPortion = patientPortion || 0;
      const safeInvoice = invoice || {};
      return `
        <div style="width: 794px; height: 1123px; font-family: 'Montserrat', sans-serif; font-size: 11px; line-height: 1.5; color: #2c2c2c; background-color: #ffffff; padding: 25px; margin: 0; box-sizing: border-box; position: relative;">
          
          <!-- Premium Header Section -->
          <div style="padding: 0; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
            
            <!-- Logo and Title on Left (Stacked) -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1;">
              ${practice.logo_url ? `
                <div style="flex-shrink: 0;">
                  <img src="${practice.logo_url}" alt="Practice Logo" style="width: 120px; height: auto; max-height: 65px; border-radius: 8px; object-fit: contain;" />
                </div>
              ` : ''}
              <div>
                <div style="font-family: 'Rubik', sans-serif; font-size: 22px; font-weight: 800; color: #5f6578; letter-spacing: -0.2px;">
                  ${practice.name}
                </div>
              </div>
            </div>
            
            <!-- Practice Details (right aligned) -->
            <div style="text-align: right; flex: 1; max-width: 300px;">
              <div style="font-size: 10px; line-height: 1.6; color: #5a5a5a; font-weight: 400;">
                ${practice.address ? `<div style="margin-bottom: 2px;">${practice.address}</div>` : ''}
                <div style="margin-bottom: 2px;">${practice.city}, ${practice.country} ${practice.postal_code || ''}</div>
                ${practice.contact_phone ? `<div style="margin-bottom: 2px;">Tel: ${practice.contact_phone}</div>` : ''}
                ${practice.contact_email ? `<div style="margin-bottom: 2px;">Email: ${practice.contact_email}</div>` : ''}
                ${practice.domain ? `<div>www.${practice.domain}</div>` : ''}
              </div>
            </div>
          </div>
          
          ${pageNumber === 1 ? `
          <!-- Refined Invoice Title Section -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 20px 0; border-bottom: 2px solid #d1d5db;">
            <div style="display: flex; align-items: flex-end; gap: 15px;">
              <div style="font-family: 'Rubik', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">
                <span style="color: #5f6578;">MEDICAL</span> <span style="color: #888;">INVOICE</span>
              </div>
              <span style="font-size: 14px; font-weight: 600; color: #666; letter-spacing: 0.3px; align-self: flex-end;">#${invoice.invoice_number || 'N/A'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 15px; font-size: 9px; color: #666;">
              <div style="text-align: center;">
                <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">DATE PREPARED</div>
                <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${invoice.created_at ? format(new Date(invoice.created_at), 'dd MMM yyyy') : 'N/A'}</div>
              </div>
              <div style="border-left: 1px solid #d1d5db; height: 30px; margin: 0 5px;"></div>
              <div style="text-align: center;">
                <div style="color: #aaa; text-transform: uppercase; margin-bottom: 3px; font-size: 7px; font-weight: 600; letter-spacing: 0.8px;">DUE DATE</div>
                <div style="font-weight: 700; color: #2c2c2c; font-size: 10px;">${format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'dd MMM yyyy')}</div>
              </div>
            </div>
          </div>

          <!-- PREPARED FOR Section -->
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #5f6578; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.3px;">PREPARED FOR</h3>
            <div style="display: flex; justify-content: space-between; gap: 25px;">
              <!-- Patient Details -->
              <div style="flex: 1;">
                <div style="line-height: 1.4;">
                  <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                    ${patientInfo.name}
                  </div>
                  ${patientInfo.phone ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.phone}</div>` : ''}
                  ${patientInfo.email ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.email}</div>` : ''}
                  ${patientInfo.address ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">${patientInfo.address}</div>` : ''}
                  ${medicalAid?.membership_number ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Medical Aid #: ${medicalAid.membership_number}</div>` : ''}
                </div>
              </div>

              <!-- Medical Aid Details (Right Aligned) -->
              ${medicalAid?.scheme || medicalAidProviderName !== 'N/A' ? `
                <div style="flex: 1; text-align: right;">
                  <div style="line-height: 1.4;">
                    <div style="font-weight: 700; font-size: 12px; color: #1a1a1a; margin-bottom: 3px;">
                      ${medicalAidProviderName}
                    </div>
                    ${medicalAid?.scheme ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Scheme: ${medicalAid.scheme}</div>` : ''}
                    ${medicalAid?.membership_number ? `<div style="color: #666; margin-bottom: 2px; font-size: 9px;">Member: ${medicalAid.membership_number}</div>` : ''}
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
                  <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Description</th>
                  <th style="padding: 12px 10px; text-align: center; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Qty</th>
                  <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Unit Price</th>
                  <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; border-right: 1px solid rgba(255,255,255,0.3); text-transform: uppercase;">Med Aid</th>
                  <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(Array.isArray(pageServices) ? pageServices : []).map((service: any, index: number) => {
                  if (!service) return '';
                  return `
                  <tr style="border-bottom: 1px solid #f3f4f6; ${index % 2 === 1 ? 'background: #f9fafb;' : ''}">
                    <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-weight: 600; color: #1f2937; font-size: 11px;">${service?.code || 'N/A'}</td>
                    <td style="padding: 12px 10px; border-right: 1px solid #e5e7eb; font-size: 11px;">
                      <div style="color: #4b5563;">${service?.description || 'Service'}</div>
                    </td>
                    <td style="padding: 12px 10px; text-align: center; border-right: 1px solid #e5e7eb; font-size: 11px;">${service?.quantity || 1}</td>
                    <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; font-size: 11px;">N$ ${(parseFloat(service?.unit_price) || 0).toFixed(2)}</td>
                    <td style="padding: 12px 10px; text-align: right; border-right: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px;">N$ ${(parseFloat(service?.medical_aid_covered) || 0).toFixed(2)}</td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: 600; color: #1f2937; font-size: 11px;">N$ ${(parseFloat(service?.total_price) || 0).toFixed(2)}</td>
                  </tr>
                `}).join('')}
                
                ${isLastPage ? `
                <!-- Summary Rows -->
                <tr>
                  <td colspan="5" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; border-right: 1px solid #e5e7eb; font-size: 11px;">Subtotal:</td>
                  <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #f9fafb; font-size: 11px;">N$ ${(pageSubtotal || 0).toFixed(2)}</td>
                </tr>
                
                <!-- Patient Portion Row -->
                <tr>
                  <td colspan="5" style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; border-right: 1px solid #fed7aa; font-size: 11px; color: #ea580c;">Patient Portion:</td>
                  <td style="padding: 12px 10px; text-align: right; font-weight: 600; background: #fff7ed; font-size: 11px; color: #ea580c;">N$ ${(safePatientPortion || 0).toFixed(2)}</td>
                </tr>
                
                <!-- Total Row -->
                <tr>
                  <td colspan="5" style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; background: #5f6578; color: white; border-right: 1px solid #5f6578; text-transform: uppercase;">Total Amount Due:</td>
                  <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 14px; background: #5f6578; color: white;">N$ ${(safeInvoice.total || 0).toFixed(2)}</td>
                </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          ${isLastPage ? `
          <!-- Banking Details Section - Clean Format from Invoice -->
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 10px; font-weight: 600; color: #5f6578; margin: 0 0 6px 0; text-transform: uppercase;">BANKING DETAILS</h3>
            <div style="font-size: 10px; line-height: 1.5; color: #4b5563;">
              Bank: ${practice.bank_name || 'FNB Namibia'} Account: ${practice.account_number || '11223344556'} Branch: ${practice.branch_code || '282273'}
            </div>
          </div>

          <!-- Professional Footer -->
          <div style="padding: 15px 0; border-top: 1px solid #e5e7eb; margin-top: 30px;">
            <div style="text-align: center;">
              <p style="margin: 0; font-size: 9px; color: #6b7280; line-height: 1.5;">
                Payment is due within 30 days. Thank you for choosing <strong style="color: #374151;">${practice.name}</strong> For inquiries: ${practice.contact_phone} • ${practice.contact_email}
              </p>
              <div style="margin-top: 12px; font-size: 8px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 8px;">
                Invoice generated by <strong style="color: #6b7280;">OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
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
    };

    // Smart pagination logic based on content space optimization
    const totalServices = services.length;
    const serviceChunks = [];
    
    if (totalServices <= 9) {
      // Single page with footer - all services fit
      serviceChunks.push(services);
    } else if (totalServices <= 13) {
      // 10-13 services: 10 on page 1, rest on page 2 with footer
      serviceChunks.push(services.slice(0, 10));
      serviceChunks.push(services.slice(10));
    } else {
      // 14+ services: 14 on page 1, then 20 per continuation page
      serviceChunks.push(services.slice(0, 14));
      
      let remainingServices = services.slice(14);
      while (remainingServices.length > 0) {
        const chunkSize = 20; // Continuation pages can fit 20 services
        serviceChunks.push(remainingServices.slice(0, chunkSize));
        remainingServices = remainingServices.slice(chunkSize);
      }
    }
    
    const totalPages = Math.max(1, serviceChunks.length);
    console.log(`📊 Smart pagination: ${totalServices} services split into ${totalPages} pages`);

    // For single page invoices, return the HTML directly
    if (totalPages === 1) {
      const pageHTML = createPageHTML(services, 1, 1, true);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap');
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Montserrat', sans-serif;
              margin: 0;
              padding: 0;
              background: white;
            }
          </style>
        </head>
        <body>
          ${pageHTML}
        </body>
        </html>
      `;
    }

    // For multi-page invoices, we need to combine pages
    const pagesHTML = serviceChunks.map((chunk, index) => {
      const pageNumber = index + 1;
      const isLastPage = index === serviceChunks.length - 1;
      return createPageHTML(chunk, pageNumber, totalPages, isLastPage);
    }).join('<div style="page-break-after: always;"></div>');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap');
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Montserrat', sans-serif;
            margin: 0;
            padding: 0;
            background: white;
          }
          @media print {
            .page-break {
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        ${pagesHTML}
      </body>
      </html>
    `;
  }

  /**
   * Convert HTML to PDF using html2canvas and jsPDF
   */
  private async htmlToPDF(html: string, format: 'a4' | 'a5' = 'a4'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.innerHTML = html;
      document.body.appendChild(container);

      // Get all pages for multi-page documents (invoices)
      const pages = container.querySelectorAll('div[style*="width: 794px"]');
      
      // For single container documents (prescriptions, leave forms)
      const singleContent = container.querySelector('.prescription-container, .leave-container');
      
      if (pages.length > 0) {
        // Multi-page document handling (invoices)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: format
        });

        let pagePromises: Promise<void>[] = [];
        
        pages.forEach((page, index) => {
          pagePromises.push(
            html2canvas(page as HTMLElement, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
            }).then(canvas => {
              if (index > 0) {
                pdf.addPage();
              }
              
              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              
              // For A4 pages, maintain aspect ratio
              const pageWidth = 794; // A4 width in pixels at 96 DPI
              const pageHeight = 1123; // A4 height in pixels at 96 DPI
              const aspectRatio = pageHeight / pageWidth;
              
              // Calculate final dimensions
              const finalWidth = pdfWidth;
              const finalHeight = pdfWidth * aspectRatio;
              
              // Add image to PDF
              pdf.addImage(imgData, 'JPEG', 0, 0, finalWidth, Math.min(finalHeight, pdfHeight));
            })
          );
        });

        Promise.all(pagePromises).then(() => {
          const blob = pdf.output('blob');
          document.body.removeChild(container);
          resolve(blob);
        }).catch(error => {
          document.body.removeChild(container);
          reject(error);
        });
        
      } else if (singleContent) {
        // Single page document handling (prescriptions, leave forms)
        html2canvas(singleContent as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        }).then(canvas => {
          try {
            const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: format
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Calculate dimensions to fit
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            
            const finalWidth = imgWidth * ratio;
            const finalHeight = imgHeight * ratio;
            
            // Center on page
            const x = (pdfWidth - finalWidth) / 2;
            const y = 0;
            
            pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
            
            const blob = pdf.output('blob');
            document.body.removeChild(container);
            resolve(blob);
          } catch (error) {
            document.body.removeChild(container);
            reject(error);
          }
        }).catch(error => {
          document.body.removeChild(container);
          reject(error);
        });
      } else {
        document.body.removeChild(container);
        reject(new Error('Failed to find content container'));
      }
    });
  }

  /**
   * Upload document to Supabase storage
   */
  private async uploadToStorage(blob: Blob, fileName: string, folder: string): Promise<string> {
    const filePath = `${folder}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, blob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    return data.path;
  }

  /**
   * Save document reference to database
   */
  private async saveDocumentReference(doc: {
    visitId: string;
    patientId: string;
    practiceId: string;
    type: string;
    documentName: string;
    filePath: string;
    fileSize: number;
  }): Promise<void> {
    const { error } = await (supabase as any)
      .from('visit_documents')
      .insert({
        visit_id: doc.visitId,
        patient_id: doc.patientId,
        practice_id: doc.practiceId,
        document_type: doc.type,
        document_name: doc.documentName,
        file_path: doc.filePath,
        file_size: doc.fileSize,
        file_type: 'application/pdf',
        generated_by: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) {
      console.error('Failed to save document reference:', error);
      throw error;
    }
  }

  /**
   * Get all documents for a visit
   */
  async getVisitDocuments(visitId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from('visit_documents')
      .select('*')
      .eq('visit_id', visitId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching visit documents:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get document URL
   */
  getDocumentUrl(filePath: string): string {
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }
}

// Export singleton instance
export const documentGenerationService = new DocumentGenerationService();