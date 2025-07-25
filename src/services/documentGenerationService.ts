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
}

export class DocumentGenerationService {
  /**
   * Generate all requested documents for a visit
   */
  async generateVisitDocuments(options: DocumentGenerationOptions): Promise<GeneratedDocument[]> {
    console.log('📄 Starting document generation for visit:', options.visitId);
    const generatedDocuments: GeneratedDocument[] = [];

    // Validate required parameters (as detected by Document Generation Agent)
    if (!options.visitId || !options.patientId || !options.practiceId) {
      console.error('❌ Document generation validation failed:', {
        visitId: !!options.visitId,
        patientId: !!options.patientId,
        practiceId: !!options.practiceId
      });
      throw new Error('Missing required parameters for document generation');
    }

    // Additional validation for patientId (agent-detected pattern)
    if (options.patientId === 'false' || options.patientId === false as any) {
      console.error('❌ Invalid patientId detected:', options.patientId);
      throw new Error('Patient ID cannot be false');
    }

    try {
      // Fetch visit data with related information
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .select(`
          *,
          patients (
            id, first_name, last_name, date_of_birth, 
            cell_number, email, home_address
          ),
          users!visits_doctor_id_fkey (
            id, full_name, email
          )
        `)
        .eq('id', options.visitId)
        .single();

      if (visitError || !visit) {
        throw new Error('Failed to fetch visit data');
      }

      // Fetch practice data
      const { data: practice, error: practiceError } = await supabase
        .from('practices')
        .select('*')
        .eq('id', options.practiceId)
        .single();

      if (practiceError || !practice) {
        throw new Error('Failed to fetch practice data');
      }

      // Generate each requested document
      for (const docType of options.documents) {
        console.log(`📄 Generating ${docType} for visit ${options.visitId}`);
        
        let generatedDoc: GeneratedDocument | null = null;

        switch (docType) {
          case 'prescription':
            generatedDoc = await this.generatePrescription(visit, practice);
            break;
          case 'leave_form':
            generatedDoc = await this.generateLeaveForm(visit, practice);
            break;
          case 'invoice':
            generatedDoc = await this.generateInvoice(visit, practice);
            break;
        }

        if (generatedDoc) {
          generatedDocuments.push(generatedDoc);
          
          // Save document reference to database
          await this.saveDocumentReference({
            visitId: options.visitId,
            patientId: options.patientId,
            practiceId: options.practiceId,
            ...generatedDoc
          });
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
  private async generatePrescription(visit: any, practice: any): Promise<GeneratedDocument | null> {
    try {
      // Check if prescription data exists
      if (!visit.prescription || visit.prescription.trim() === '') {
        console.log('ℹ️ No prescription data for this visit');
        return null;
      }

      // Parse prescription data
      const prescriptionData = this.parsePrescriptionData(visit.prescription);
      
      // Create HTML content for prescription
      const html = this.createPrescriptionHTML(visit, practice, prescriptionData);
      
      // Generate PDF
      const pdfBlob = await this.htmlToPDF(html, 'a5');
      
      // Upload to storage
      const fileName = `prescription_${visit.id}_${Date.now()}.pdf`;
      const filePath = await this.uploadToStorage(pdfBlob, fileName, 'prescriptions');
      
      return {
        type: 'prescription',
        documentName: `Prescription - ${format(new Date(), 'dd/MM/yyyy')}`,
        filePath,
        fileSize: pdfBlob.size
      };
    } catch (error) {
      console.error('Error generating prescription:', error);
      return null;
    }
  }

  /**
   * Generate leave form PDF
   */
  private async generateLeaveForm(visit: any, practice: any): Promise<GeneratedDocument | null> {
    try {
      // Fetch leave form data
      const { data: leaveForm, error } = await supabase
        .from('leave_forms')
        .select('*')
        .eq('visit_id', visit.id)
        .single();

      if (error || !leaveForm) {
        console.log('ℹ️ No leave form data for this visit');
        return null;
      }

      // Create HTML content for leave form
      const html = this.createLeaveFormHTML(visit, practice, leaveForm);
      
      // Generate PDF
      const pdfBlob = await this.htmlToPDF(html, 'a5');
      
      // Upload to storage
      const fileName = `leave_form_${leaveForm.form_number || visit.id}_${Date.now()}.pdf`;
      const filePath = await this.uploadToStorage(pdfBlob, fileName, 'leave_forms');
      
      return {
        type: 'leave_form',
        documentName: `Leave Form - ${leaveForm.form_number || format(new Date(), 'dd/MM/yyyy')}`,
        filePath,
        fileSize: pdfBlob.size
      };
    } catch (error) {
      console.error('Error generating leave form:', error);
      return null;
    }
  }

  /**
   * Generate invoice PDF
   */
  private async generateInvoice(visit: any, practice: any): Promise<GeneratedDocument | null> {
    try {
      // Fetch invoice data
      const { data: invoice, error } = await supabase
        .from('invoices_enhanced')
        .select(`
          *,
          invoice_services (*)
        `)
        .eq('visit_id', visit.id)
        .single();

      if (error || !invoice) {
        console.log('ℹ️ No invoice data for this visit');
        return null;
      }

      // Create HTML content for invoice (reuse existing invoice HTML generation)
      const html = this.createInvoiceHTML(visit, practice, invoice);
      
      // Generate PDF
      const pdfBlob = await this.htmlToPDF(html, 'a4');
      
      // Upload to storage
      const fileName = `invoice_${invoice.invoice_number}_${Date.now()}.pdf`;
      const filePath = await this.uploadToStorage(pdfBlob, fileName, 'invoices');
      
      return {
        type: 'invoice',
        documentName: `Invoice - ${invoice.invoice_number}`,
        filePath,
        fileSize: pdfBlob.size
      };
    } catch (error) {
      console.error('Error generating invoice:', error);
      return null;
    }
  }

  /**
   * Parse prescription text into structured data
   */
  private parsePrescriptionData(prescriptionText: string): any[] {
    const lines = prescriptionText.trim().split('\n');
    const medications: any[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Basic parsing - can be enhanced based on format
        medications.push({
          medication: trimmed,
          dosage: '',
          frequency: '',
          duration: '',
          instructions: ''
        });
      }
    }
    
    return medications;
  }

  /**
   * Create prescription HTML
   */
  private createPrescriptionHTML(visit: any, practice: any, medications: any[]): string {
    const patient = visit.patients;
    const doctor = visit.users;
    const logoUrl = practice.logo_url || '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Montserrat', sans-serif;
            background: white;
            color: #333;
            line-height: 1.6;
          }
          
          .prescription-container {
            width: 148mm;
            min-height: 210mm;
            padding: 15mm;
            margin: 0 auto;
            background: white;
            position: relative;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #80788a;
          }
          
          .logo {
            max-width: 120px;
            max-height: 60px;
            margin-bottom: 10px;
          }
          
          .practice-name {
            font-size: 18px;
            font-weight: 600;
            color: #80788a;
            margin-bottom: 5px;
          }
          
          .practice-details {
            font-size: 11px;
            color: #666;
            line-height: 1.4;
          }
          
          .rx-symbol {
            font-size: 36px;
            font-weight: 700;
            color: #80788a;
            margin: 15px 0;
            text-align: center;
          }
          
          .patient-info {
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 12px;
          }
          
          .info-label {
            font-weight: 500;
            color: #666;
          }
          
          .medications {
            min-height: 200px;
            margin-bottom: 30px;
          }
          
          .medication-item {
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-left: 3px solid #80788a;
            border-radius: 4px;
          }
          
          .medication-name {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
          }
          
          .medication-details {
            font-size: 12px;
            color: #666;
          }
          
          .footer {
            position: absolute;
            bottom: 15mm;
            left: 15mm;
            right: 15mm;
          }
          
          .signature-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
          }
          
          .signature-box {
            text-align: center;
            min-width: 150px;
          }
          
          .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 5px;
            height: 40px;
          }
          
          .signature-label {
            font-size: 11px;
            color: #666;
          }
          
          .date-issued {
            font-size: 11px;
            color: #666;
            text-align: right;
            margin-top: 10px;
          }
          
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 60px;
            color: rgba(128, 120, 138, 0.1);
            font-weight: 700;
            z-index: 0;
          }
        </style>
      </head>
      <body>
        <div class="prescription-container">
          <div class="watermark">PRESCRIPTION</div>
          
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="Practice Logo" class="logo">` : ''}
            <div class="practice-name">${practice.name}</div>
            <div class="practice-details">
              ${practice.address ? `${practice.address}<br>` : ''}
              ${practice.contact_phone ? `Tel: ${practice.contact_phone}` : ''}
              ${practice.contact_email ? ` | Email: ${practice.contact_email}` : ''}
              ${practice.practice_number ? `<br>Practice No: ${practice.practice_number}` : ''}
            </div>
          </div>
          
          <div class="rx-symbol">℞</div>
          
          <div class="patient-info">
            <div class="info-row">
              <span class="info-label">Patient:</span>
              <span>${patient.first_name} ${patient.last_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date of Birth:</span>
              <span>${patient.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span>${format(new Date(visit.visit_date || visit.created_at), 'dd/MM/yyyy')}</span>
            </div>
            ${patient.home_address ? `
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span>${patient.home_address}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="medications">
            ${medications.map(med => `
              <div class="medication-item">
                <div class="medication-name">${med.medication}</div>
                ${med.dosage || med.frequency || med.duration ? `
                  <div class="medication-details">
                    ${med.dosage ? `Dosage: ${med.dosage} | ` : ''}
                    ${med.frequency ? `Frequency: ${med.frequency} | ` : ''}
                    ${med.duration ? `Duration: ${med.duration}` : ''}
                  </div>
                ` : ''}
                ${med.instructions ? `
                  <div class="medication-details">
                    Instructions: ${med.instructions}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
          
          <div class="footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Patient Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">${doctor?.full_name || 'Doctor'}</div>
                <div class="signature-label">Prescribing Physician</div>
              </div>
            </div>
            <div class="date-issued">
              Issued: ${format(new Date(), 'dd/MM/yyyy HH:mm')}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create leave form HTML
   */
  private createLeaveFormHTML(visit: any, practice: any, leaveForm: any): string {
    const patient = visit.patients;
    const doctor = visit.users;
    const logoUrl = practice.logo_url || '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Montserrat', sans-serif;
            background: white;
            color: #333;
            line-height: 1.6;
          }
          
          .leave-container {
            width: 148mm;
            min-height: 210mm;
            padding: 15mm;
            margin: 0 auto;
            background: white;
            position: relative;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #80788a;
          }
          
          .logo {
            max-width: 120px;
            max-height: 60px;
            margin-bottom: 10px;
          }
          
          .practice-name {
            font-size: 18px;
            font-weight: 600;
            color: #80788a;
            margin-bottom: 5px;
          }
          
          .practice-details {
            font-size: 11px;
            color: #666;
            line-height: 1.4;
          }
          
          .title {
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            color: #80788a;
            margin: 20px 0;
            text-transform: uppercase;
          }
          
          .form-number {
            text-align: right;
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
          }
          
          .content {
            margin: 20px 0;
            font-size: 13px;
            line-height: 1.8;
          }
          
          .section {
            margin-bottom: 20px;
          }
          
          .section-title {
            font-weight: 600;
            color: #80788a;
            margin-bottom: 10px;
            font-size: 14px;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
          }
          
          .info-item {
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
          }
          
          .info-label {
            font-weight: 500;
            color: #666;
            font-size: 11px;
          }
          
          .info-value {
            font-size: 12px;
            color: #333;
            margin-top: 2px;
          }
          
          .certification-text {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-left: 3px solid #80788a;
            font-size: 13px;
          }
          
          .fitness-status {
            margin: 20px 0;
            padding: 10px;
            border: 2px solid #80788a;
            border-radius: 8px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
          }
          
          .footer {
            position: absolute;
            bottom: 15mm;
            left: 15mm;
            right: 15mm;
          }
          
          .signature-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
          }
          
          .signature-box {
            text-align: center;
            min-width: 150px;
          }
          
          .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 5px;
            height: 40px;
          }
          
          .signature-label {
            font-size: 11px;
            color: #666;
          }
          
          .date-issued {
            font-size: 11px;
            color: #666;
            text-align: center;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="leave-container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="Practice Logo" class="logo">` : ''}
            <div class="practice-name">${practice.name}</div>
            <div class="practice-details">
              ${practice.address ? `${practice.address}<br>` : ''}
              ${practice.contact_phone ? `Tel: ${practice.contact_phone}` : ''}
              ${practice.contact_email ? ` | Email: ${practice.contact_email}` : ''}
              ${practice.practice_number ? `<br>Practice No: ${practice.practice_number}` : ''}
            </div>
          </div>
          
          <div class="title">Medical Certificate</div>
          
          ${leaveForm.form_number ? `
            <div class="form-number">Certificate No: ${leaveForm.form_number}</div>
          ` : ''}
          
          <div class="content">
            <div class="section">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Patient Name</div>
                  <div class="info-value">${patient.first_name} ${patient.last_name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Date of Birth</div>
                  <div class="info-value">${patient.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : 'N/A'}</div>
                </div>
                ${leaveForm.patient_employer ? `
                  <div class="info-item">
                    <div class="info-label">Employer</div>
                    <div class="info-value">${leaveForm.patient_employer}</div>
                  </div>
                ` : ''}
                ${leaveForm.patient_occupation ? `
                  <div class="info-item">
                    <div class="info-label">Occupation</div>
                    <div class="info-value">${leaveForm.patient_occupation}</div>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <div class="certification-text">
              This is to certify that the above-named patient was examined and treated on 
              ${format(new Date(visit.visit_date || visit.created_at), 'dd/MM/yyyy')}.
              ${leaveForm.diagnosis ? `<br><br>Diagnosis: <strong>${leaveForm.diagnosis}</strong>` : ''}
              ${leaveForm.diagnosis_code ? ` (ICD-10: ${leaveForm.diagnosis_code})` : ''}
            </div>
            
            <div class="section">
              <div class="section-title">Medical Leave Period</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">From Date</div>
                  <div class="info-value">${format(new Date(leaveForm.from_date), 'dd/MM/yyyy')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">To Date</div>
                  <div class="info-value">${format(new Date(leaveForm.to_date), 'dd/MM/yyyy')}</div>
                </div>
              </div>
            </div>
            
            <div class="fitness-status">
              ${leaveForm.fitness_status === 'unfit' ? 'UNFIT FOR WORK' : 
                leaveForm.fitness_status === 'light_duty' ? 'FIT FOR LIGHT DUTY ONLY' :
                'FIT FOR WORK WITH RESTRICTIONS'}
            </div>
            
            ${leaveForm.restrictions ? `
              <div class="section">
                <div class="section-title">Restrictions/Limitations</div>
                <p>${leaveForm.restrictions}</p>
              </div>
            ` : ''}
            
            ${leaveForm.follow_up_required ? `
              <div class="section">
                <div class="section-title">Follow-up Required</div>
                <p>Patient must return for follow-up on: ${format(new Date(leaveForm.follow_up_date), 'dd/MM/yyyy')}</p>
              </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">${doctor?.full_name || 'Doctor'}</div>
                <div class="signature-label">Medical Practitioner</div>
              </div>
            </div>
            <div class="date-issued">
              Issued on: ${format(new Date(), 'dd/MM/yyyy')}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create invoice HTML (using existing style)
   */
  private createInvoiceHTML(visit: any, practice: any, invoice: any): string {
    const patient = visit.patients;
    const services = invoice.invoice_services || [];
    const logoUrl = practice.logo_url || '';
    const currency = practice.country === 'Namibia' ? 'N$' : '$';
    
    // Calculate totals
    const subtotal = services.reduce((sum: number, s: any) => sum + (s.total_price || 0), 0);
    const tax = subtotal * 0.15; // 15% VAT
    const total = subtotal + tax;
    const medicalAidCovered = services.reduce((sum: number, s: any) => sum + (s.medical_aid_covered || 0), 0);
    const patientPortion = services.reduce((sum: number, s: any) => sum + (s.patient_portion || 0), 0);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Montserrat', sans-serif;
            font-size: 12px;
            color: #333;
            background-color: white;
            margin: 0;
            padding: 20px;
          }
          
          .invoice-container {
            max-width: 794px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          
          /* Header Styles */
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #80788a;
          }
          
          .company-info {
            flex: 1;
          }
          
          .company-logo {
            max-width: 180px;
            max-height: 80px;
            margin-bottom: 15px;
          }
          
          .company-name {
            font-size: 24px;
            font-weight: 700;
            color: #80788a;
            margin-bottom: 10px;
          }
          
          .company-details {
            color: #666;
            line-height: 1.6;
          }
          
          .invoice-title-section {
            text-align: right;
            flex: 0 0 300px;
          }
          
          .invoice-title {
            font-size: 36px;
            font-weight: 300;
            color: #80788a;
            margin-bottom: 10px;
            letter-spacing: -1px;
          }
          
          .invoice-number {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
          }
          
          .invoice-date {
            font-size: 14px;
            color: #666;
          }
          
          /* Client and Payment Info */
          .billing-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            gap: 40px;
          }
          
          .info-section {
            flex: 1;
          }
          
          .info-title {
            font-size: 14px;
            font-weight: 600;
            color: #80788a;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .info-content {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 3px solid #80788a;
          }
          
          .info-line {
            margin-bottom: 5px;
            color: #333;
          }
          
          .info-line strong {
            color: #80788a;
          }
          
          /* Services Table */
          .services-section {
            margin-bottom: 40px;
          }
          
          .services-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          
          .services-table th {
            background: #80788a;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .services-table td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
          }
          
          .services-table tr:hover {
            background: #f8f9fa;
          }
          
          .service-code {
            font-weight: 600;
            color: #80788a;
          }
          
          .text-right {
            text-align: right;
          }
          
          /* Totals Section */
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
          }
          
          .totals-box {
            width: 350px;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border: 2px solid #80788a;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
          }
          
          .total-row.subtotal {
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          
          .total-row.grand-total {
            border-top: 2px solid #80788a;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 18px;
            font-weight: 600;
            color: #80788a;
          }
          
          .total-label {
            color: #666;
          }
          
          .total-value {
            font-weight: 500;
          }
          
          /* Medical Aid Section */
          .medical-aid-section {
            background: #e8f4f8;
            border: 1px solid #b8e0ea;
            border-radius: 8px;
            padding: 15px 20px;
            margin-top: 15px;
          }
          
          .medical-aid-title {
            font-weight: 600;
            color: #0284c7;
            margin-bottom: 10px;
          }
          
          /* Footer */
          .invoice-footer {
            border-top: 2px solid #80788a;
            padding-top: 30px;
            margin-top: 50px;
          }
          
          .footer-content {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          
          .payment-terms {
            flex: 1;
          }
          
          .terms-title {
            font-weight: 600;
            color: #80788a;
            margin-bottom: 10px;
          }
          
          .terms-content {
            color: #666;
            line-height: 1.6;
          }
          
          .bank-details {
            flex: 1;
            text-align: right;
          }
          
          .thank-you {
            text-align: center;
            color: #80788a;
            font-size: 14px;
            font-weight: 500;
            margin-top: 30px;
          }
          
          /* Status Badge */
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .status-paid {
            background: #d1fae5;
            color: #065f46;
          }
          
          .status-pending {
            background: #fef3c7;
            color: #92400e;
          }
          
          .status-overdue {
            background: #fee2e2;
            color: #991b1b;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="invoice-header">
            <div class="company-info">
              ${logoUrl ? `<img src="${logoUrl}" alt="${practice.name}" class="company-logo">` : ''}
              <div class="company-name">${practice.name}</div>
              <div class="company-details">
                ${practice.address ? `${practice.address}<br>` : ''}
                ${practice.city ? `${practice.city}, ` : ''}${practice.country || ''}<br>
                ${practice.contact_phone ? `Tel: ${practice.contact_phone}<br>` : ''}
                ${practice.contact_email ? `Email: ${practice.contact_email}<br>` : ''}
                ${practice.tax_number ? `VAT No: ${practice.tax_number}` : ''}
              </div>
            </div>
            
            <div class="invoice-title-section">
              <div class="invoice-title">INVOICE</div>
              <div class="invoice-number">#${invoice.invoice_number}</div>
              <div class="invoice-date">Date: ${format(new Date(invoice.issue_date || invoice.created_at), 'dd/MM/yyyy')}</div>
              <div class="invoice-date">Due: ${format(new Date(invoice.due_date), 'dd/MM/yyyy')}</div>
              <span class="status-badge status-${invoice.payment_status}">${invoice.payment_status}</span>
            </div>
          </div>
          
          <!-- Billing Info -->
          <div class="billing-info">
            <div class="info-section">
              <div class="info-title">Bill To</div>
              <div class="info-content">
                <div class="info-line"><strong>${patient.first_name} ${patient.last_name}</strong></div>
                ${patient.cell_number ? `<div class="info-line">Tel: ${patient.cell_number}</div>` : ''}
                ${patient.email ? `<div class="info-line">Email: ${patient.email}</div>` : ''}
                ${patient.home_address ? `<div class="info-line">${patient.home_address}</div>` : ''}
              </div>
            </div>
            
            <div class="info-section">
              <div class="info-title">Visit Details</div>
              <div class="info-content">
                <div class="info-line">Visit Date: <strong>${format(new Date(visit.visit_date || visit.created_at), 'dd/MM/yyyy')}</strong></div>
                <div class="info-line">Visit Type: <strong>${visit.visit_type || 'Consultation'}</strong></div>
                ${visit.chief_complaint ? `<div class="info-line">Chief Complaint: <strong>${visit.chief_complaint}</strong></div>` : ''}
                ${visit.diagnosis ? `<div class="info-line">Diagnosis: <strong>${visit.diagnosis}</strong></div>` : ''}
              </div>
            </div>
          </div>
          
          <!-- Services Table -->
          <div class="services-section">
            <div class="info-title">Services Rendered</div>
            <table class="services-table">
              <thead>
                <tr>
                  <th style="width: 15%">Code</th>
                  <th style="width: 45%">Description</th>
                  <th style="width: 10%" class="text-right">Qty</th>
                  <th style="width: 15%" class="text-right">Unit Price</th>
                  <th style="width: 15%" class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${services.map((service: any) => `
                  <tr>
                    <td class="service-code">${service.code}</td>
                    <td>${service.description}</td>
                    <td class="text-right">${service.quantity}</td>
                    <td class="text-right">${currency} ${service.unit_price.toFixed(2)}</td>
                    <td class="text-right">${currency} ${service.total_price.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row subtotal">
                <span class="total-label">Subtotal</span>
                <span class="total-value">${currency} ${subtotal.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">VAT (15%)</span>
                <span class="total-value">${currency} ${tax.toFixed(2)}</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Total Amount</span>
                <span class="total-value">${currency} ${total.toFixed(2)}</span>
              </div>
              
              ${medicalAidCovered > 0 ? `
                <div class="medical-aid-section">
                  <div class="medical-aid-title">Medical Aid Coverage</div>
                  <div class="total-row">
                    <span class="total-label">Medical Aid Pays</span>
                    <span class="total-value">${currency} ${medicalAidCovered.toFixed(2)}</span>
                  </div>
                  <div class="total-row">
                    <span class="total-label">Patient Pays</span>
                    <span class="total-value">${currency} ${patientPortion.toFixed(2)}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Footer -->
          <div class="invoice-footer">
            <div class="footer-content">
              <div class="payment-terms">
                <div class="terms-title">Payment Terms</div>
                <div class="terms-content">
                  Payment is due within 30 days of invoice date.<br>
                  Please reference invoice number with payment.
                </div>
              </div>
              
              ${practice.bank_name ? `
                <div class="bank-details">
                  <div class="terms-title">Banking Details</div>
                  <div class="terms-content">
                    Bank: ${practice.bank_name}<br>
                    ${practice.account_number ? `Account: ${practice.account_number}<br>` : ''}
                    ${practice.branch_code ? `Branch Code: ${practice.branch_code}<br>` : ''}
                    ${practice.swift_code ? `SWIFT: ${practice.swift_code}` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
            
            <div class="thank-you">Thank you for your business!</div>
          </div>
        </div>
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

      // Get the content div
      const content = container.querySelector('.prescription-container, .leave-container, .invoice-container') as HTMLElement;
      
      if (!content) {
        document.body.removeChild(container);
        reject(new Error('Failed to find content container'));
        return;
      }

      // Generate canvas
      html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      }).then(canvas => {
        try {
          // Create PDF
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
          
          // Convert to blob
          const blob = pdf.output('blob');
          
          // Cleanup
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
    const { error } = await supabase
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
    const { data, error } = await supabase
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