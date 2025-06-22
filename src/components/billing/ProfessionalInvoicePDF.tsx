import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  pdf
} from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';

// Register fonts for better typography
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZs.woff2' },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuDyfMZs.woff2', fontWeight: 'bold' }
  ]
});

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 10,
    fontFamily: 'Inter',
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2px solid #e2e8f0',
  },
  practiceInfo: {
    flex: 1,
  },
  practiceName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
  },
  practiceTagline: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  practiceDetails: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.5,
  },
  invoiceTitle: {
    textAlign: 'right',
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 15,
  },
  statusBadge: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: '8 12',
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0284c7',
    textTransform: 'uppercase',
  },
  billingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 20,
  },
  billingCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 15,
    border: '1px solid #e2e8f0',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    fontSize: 10,
    color: '#4b5563',
    lineHeight: 1.5,
  },
  servicesSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
    paddingBottom: 5,
    borderBottom: '1px solid #e2e8f0',
  },
  table: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    padding: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #f1f5f9',
    padding: 12,
    minHeight: 40,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  headerCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell: {
    fontSize: 10,
    color: '#4b5563',
    justifyContent: 'center',
  },
  cellCode: {
    width: '15%',
    fontFamily: 'Courier',
    fontWeight: 'bold',
  },
  cellDescription: {
    width: '40%',
  },
  cellQty: {
    width: '10%',
    textAlign: 'center',
  },
  cellPrice: {
    width: '15%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  cellAid: {
    width: '15%',
    textAlign: 'right',
    color: '#059669',
    fontWeight: 'bold',
  },
  cellTotal: {
    width: '15%',
    textAlign: 'right',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  summarySection: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '60%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderBottom: '1px solid #f1f5f9',
  },
  summaryRowTotal: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontWeight: 'bold',
    borderRadius: '8 8 0 0',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  summaryValueTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 1.5,
  },
  visitInfo: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    border: '1px solid #d1fae5',
  },
  visitTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 5,
  },
  visitDetails: {
    fontSize: 10,
    color: '#047857',
    lineHeight: 1.4,
  },
});

interface Invoice {
  id: string;
  invoice_number: string;
  visit_id: string;
  visit_date?: string;
  visit_number?: number;
  chief_complaint?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  payment_method?: string;
  total: number;
  created_at: string;
  services: Service[];
  medical_aid_covered: number;
  patient_portion: number;
}

interface Service {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  medical_aid_covered: number;
  patient_portion: number;
}

interface PracticeInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  registration?: string;
}

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  membershipNumber?: string;
}

interface ProfessionalInvoicePDFProps {
  invoice: Invoice;
  patient: PatientInfo;
  practice?: Partial<PracticeInfo>;
}

const defaultPractice: PracticeInfo = {
  name: 'OneHealth Medical Practice',
  tagline: 'Comprehensive Healthcare Excellence',
  address: '123 Healthcare Avenue, Windhoek, Namibia',
  phone: '+264 61 123 4567',
  email: 'info@onehealth.com.na',
  website: 'www.onehealth.com.na',
  registration: 'Practice No: HP-2024-001',
};

const ProfessionalInvoicePDF: React.FC<ProfessionalInvoicePDFProps> = ({
  invoice,
  patient,
  practice = {},
}) => {
  const practiceInfo = { ...defaultPractice, ...practice };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#f0fdf4', text: '#166534' };
      case 'pending':
        return { bg: '#fef3c7', text: '#d97706' };
      case 'overdue':
        return { bg: '#fef2f2', text: '#dc2626' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  const statusColor = getStatusColor(invoice.payment_status);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.practiceInfo}>
            <Text style={styles.practiceName}>{practiceInfo.name}</Text>
            <Text style={styles.practiceTagline}>{practiceInfo.tagline}</Text>
            <View style={styles.practiceDetails}>
              <Text>{practiceInfo.address}</Text>
              <Text>Phone: {practiceInfo.phone}</Text>
              <Text>Email: {practiceInfo.email}</Text>
              {practiceInfo.website && <Text>Web: {practiceInfo.website}</Text>}
              {practiceInfo.registration && <Text>{practiceInfo.registration}</Text>}
            </View>
          </View>
          
          <View style={styles.invoiceTitle}>
            <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
            <Text style={styles.invoiceDate}>
              {format(parseISO(invoice.created_at), 'MMMM dd, yyyy')}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {invoice.payment_status}
              </Text>
            </View>
          </View>
        </View>

        {/* Billing Information */}
        <View style={styles.billingSection}>
          <View style={styles.billingCard}>
            <Text style={styles.cardTitle}>Bill To</Text>
            <View style={styles.cardContent}>
              <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>{patient.name}</Text>
              {patient.phone && <Text>Phone: {patient.phone}</Text>}
              {patient.email && <Text>Email: {patient.email}</Text>}
              {patient.address && <Text>{patient.address}</Text>}
            </View>
          </View>

          {patient.medicalAidProvider && (
            <View style={styles.billingCard}>
              <Text style={styles.cardTitle}>Medical Aid</Text>
              <View style={styles.cardContent}>
                <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>
                  {patient.medicalAidProvider}
                </Text>
                {patient.membershipNumber && (
                  <Text>Member: {patient.membershipNumber}</Text>
                )}
                <Text style={{ color: '#059669', fontWeight: 'bold' }}>
                  Coverage: N$ {invoice.medical_aid_covered.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Visit Information */}
        {invoice.visit_date && (
          <View style={styles.visitInfo}>
            <Text style={styles.visitTitle}>
              Visit #{invoice.visit_number} - {format(parseISO(invoice.visit_date), 'MMMM dd, yyyy')}
            </Text>
            {invoice.chief_complaint && (
              <Text style={styles.visitDetails}>
                Chief Complaint: {invoice.chief_complaint}
              </Text>
            )}
          </View>
        )}

        {/* Services Table */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Services & Procedures</Text>
          
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.cellCode]}>Code</Text>
              <Text style={[styles.headerCell, styles.cellDescription]}>Description</Text>
              <Text style={[styles.headerCell, styles.cellQty]}>Qty</Text>
              <Text style={[styles.headerCell, styles.cellPrice]}>Unit Price</Text>
              <Text style={[styles.headerCell, styles.cellAid]}>Medical Aid</Text>
              <Text style={[styles.headerCell, styles.cellTotal]}>Total</Text>
            </View>

            {/* Table Rows */}
            {invoice.services.map((service, index) => (
              <View 
                key={service.id} 
                style={[
                  styles.tableRow, 
                  index % 2 === 1 ? styles.tableRowEven : {}
                ]}
              >
                <Text style={[styles.cell, styles.cellCode]}>{service.code}</Text>
                <Text style={[styles.cell, styles.cellDescription]}>
                  {service.description}
                </Text>
                <Text style={[styles.cell, styles.cellQty]}>{service.quantity}</Text>
                <Text style={[styles.cell, styles.cellPrice]}>
                  N$ {service.unit_price.toFixed(2)}
                </Text>
                <Text style={[styles.cell, styles.cellAid]}>
                  N$ {service.medical_aid_covered.toFixed(2)}
                </Text>
                <Text style={[styles.cell, styles.cellTotal]}>
                  N$ {service.total_price.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={[styles.summaryRow]}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>
              N$ {invoice.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
            </Text>
          </View>
          
          {invoice.medical_aid_covered > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Medical Aid Coverage:</Text>
              <Text style={[styles.summaryValue, { color: '#059669' }]}>
                -N$ {invoice.medical_aid_covered.toFixed(2)}
              </Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Patient Portion:</Text>
            <Text style={styles.summaryValue}>
              N$ {invoice.patient_portion.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.summaryRow, styles.summaryRowTotal]}>
            <Text style={[styles.summaryLabel, { color: '#ffffff' }]}>TOTAL AMOUNT:</Text>
            <Text style={styles.summaryValueTotal}>
              N$ {invoice.total.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Payment is due within 30 days of invoice date.{'\n'}
            Thank you for choosing {practiceInfo.name} for your healthcare needs.{'\n'}
            For billing inquiries, please contact us at {practiceInfo.phone} or {practiceInfo.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Export function to generate PDF blob
export const generateInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice?: Partial<PracticeInfo>
): Promise<Blob> => {
  const doc = <ProfessionalInvoicePDF invoice={invoice} patient={patient} practice={practice} />;
  return await pdf(doc).toBlob();
};

// Export function to download PDF
export const downloadInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice?: Partial<PracticeInfo>
): Promise<void> => {
  const blob = await generateInvoicePDF(invoice, patient, practice);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${invoice.invoice_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default ProfessionalInvoicePDF;