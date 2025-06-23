import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
  Font
} from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';

// Register Montserrat font
Font.register({
  family: 'Montserrat',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459Wlhyw.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459W1hyw.ttf',
      fontWeight: 'bold',
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459WRhyw.ttf',
      fontWeight: 600,
    }
  ]
});

// Stunning styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontSize: 9,
    fontFamily: 'Montserrat',
    lineHeight: 1.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#01b9d5',
  },
  practiceSection: {
    flex: 1,
    maxWidth: '60%',
  },
  logoContainer: {
    marginBottom: 8,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  practiceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 4,
    lineHeight: 1.2,
  },
  practiceTagline: {
    fontSize: 10,
    color: '#01b9d5',
    marginBottom: 8,
    fontWeight: 600,
  },
  practiceDetails: {
    fontSize: 8,
    color: '#4a5568',
    lineHeight: 1.4,
  },
  invoiceSection: {
    flex: 1,
    maxWidth: '35%',
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#01b9d5',
    marginBottom: 5,
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 3,
    textAlign: 'right',
  },
  invoiceDate: {
    fontSize: 9,
    color: '#718096',
    marginBottom: 10,
    textAlign: 'right',
  },
  statusContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#01b9d5',
  },
  statusText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#01b9d5',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  billingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  billingCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    fontSize: 8,
    color: '#4a5568',
    lineHeight: 1.4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 2,
  },
  visitSection: {
    backgroundColor: '#f0fff4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  visitTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#22543d',
    marginBottom: 4,
  },
  visitDetails: {
    fontSize: 8,
    color: '#2f855a',
    lineHeight: 1.3,
  },
  servicesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 10,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  table: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#01b9d5',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 8,
    minHeight: 30,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cell: {
    fontSize: 8,
    color: '#4a5568',
    alignSelf: 'center',
  },
  cellCode: {
    width: '12%',
    fontWeight: 'bold',
    color: '#1a365d',
  },
  cellDescription: {
    width: '38%',
  },
  cellQty: {
    width: '8%',
    textAlign: 'center',
  },
  cellPrice: {
    width: '14%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  cellAid: {
    width: '14%',
    textAlign: 'right',
    color: '#22543d',
    fontWeight: 'bold',
  },
  cellTotal: {
    width: '14%',
    textAlign: 'right',
    fontWeight: 'bold',
    color: '#1a365d',
  },
  summarySection: {
    marginTop: 15,
    alignSelf: 'flex-end',
    width: '50%',
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  summaryRowTotal: {
    backgroundColor: '#01b9d5',
    marginHorizontal: -8,
    marginTop: 8,
    marginBottom: -8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#4a5568',
    fontWeight: 600,
  },
  summaryLabelTotal: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1a365d',
  },
  summaryValueTotal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#718096',
    lineHeight: 1.4,
  },
  footerHighlight: {
    color: '#01b9d5',
    fontWeight: 'bold',
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: 48,
    color: '#f0f9ff',
    fontWeight: 'bold',
    zIndex: -1,
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
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  logo_url?: string;
  license_number?: string;
  tax_number?: string;
  practice_number?: string;
  primary_color?: string;
}

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  membershipNumber?: string;
}

interface WowInvoicePDFProps {
  invoice: Invoice;
  patient: PatientInfo;
  practice: PracticeInfo;
}

const WowInvoicePDF: React.FC<WowInvoicePDFProps> = ({
  invoice,
  patient,
  practice,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#f0fdf4', text: '#22543d', border: '#c6f6d5' };
      case 'pending':
        return { bg: '#fffbeb', text: '#d69e2e', border: '#f6e05e' };
      case 'overdue':
        return { bg: '#fed7d7', text: '#c53030', border: '#feb2b2' };
      default:
        return { bg: '#f7fafc', text: '#4a5568', border: '#e2e8f0' };
    }
  };

  const statusColor = getStatusColor(invoice.payment_status);
  const currency = practice.country === 'Namibia' ? 'N$' : '$';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        {invoice.payment_status === 'paid' && (
          <Text style={styles.watermark}>PAID</Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.practiceSection}>
            {practice.logo_url && (
              <View style={styles.logoContainer}>
                <Image style={styles.logo} src={practice.logo_url} />
              </View>
            )}
            <Text style={styles.practiceName}>{practice.name}</Text>
            <Text style={styles.practiceTagline}>Professional Healthcare Services</Text>
            <View style={styles.practiceDetails}>
              <Text>{practice.address}</Text>
              {practice.city && practice.country && (
                <Text>{practice.city}, {practice.country}</Text>
              )}
              {practice.postal_code && <Text>Postal Code: {practice.postal_code}</Text>}
              <Text>Phone: {practice.contact_phone}</Text>
              <Text>Email: {practice.contact_email}</Text>
              {practice.license_number && <Text>License: {practice.license_number}</Text>}
              {practice.practice_number && <Text>Practice No: {practice.practice_number}</Text>}
            </View>
          </View>
          
          <View style={styles.invoiceSection}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
            <Text style={styles.invoiceDate}>
              {format(parseISO(invoice.created_at), 'MMMM dd, yyyy')}
            </Text>
            <View style={[
              styles.statusContainer, 
              { 
                backgroundColor: statusColor.bg, 
                borderColor: statusColor.border 
              }
            ]}>
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
              <Text style={styles.boldText}>{patient.name}</Text>
              {patient.phone && <Text>Phone: {patient.phone}</Text>}
              {patient.email && <Text>Email: {patient.email}</Text>}
              {patient.address && <Text>{patient.address}</Text>}
            </View>
          </View>

          {patient.medicalAidProvider && (
            <View style={styles.billingCard}>
              <Text style={styles.cardTitle}>Medical Aid</Text>
              <View style={styles.cardContent}>
                <Text style={styles.boldText}>{patient.medicalAidProvider}</Text>
                {patient.membershipNumber && (
                  <Text>Member: {patient.membershipNumber}</Text>
                )}
                <Text style={{ color: '#22543d', fontWeight: 'bold', marginTop: 4 }}>
                  Coverage: {currency} {invoice.medical_aid_covered.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Visit Information */}
        {invoice.visit_date && (
          <View style={styles.visitSection}>
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
              <Text style={[styles.headerCell, styles.cellAid]}>Med Aid</Text>
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
                  {currency} {service.unit_price.toFixed(2)}
                </Text>
                <Text style={[styles.cell, styles.cellAid]}>
                  {currency} {service.medical_aid_covered.toFixed(2)}
                </Text>
                <Text style={[styles.cell, styles.cellTotal]}>
                  {currency} {service.total_price.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>
                {currency} {invoice.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
              </Text>
            </View>
            
            {invoice.medical_aid_covered > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Medical Aid Coverage:</Text>
                <Text style={[styles.summaryValue, { color: '#22543d' }]}>
                  -{currency} {invoice.medical_aid_covered.toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Patient Portion:</Text>
              <Text style={styles.summaryValue}>
                {currency} {invoice.patient_portion.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.summaryRowTotal}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelTotal}>Total Amount:</Text>
                <Text style={styles.summaryValueTotal}>
                  {currency} {invoice.total.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Payment is due within 30 days of invoice date. Thank you for choosing{' '}
            <Text style={styles.footerHighlight}>{practice.name}</Text> for your healthcare needs.{'\n'}
            For billing inquiries, please contact us at{' '}
            <Text style={styles.footerHighlight}>{practice.contact_phone}</Text> or{' '}
            <Text style={styles.footerHighlight}>{practice.contact_email}</Text>
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
  practice: PracticeInfo
): Promise<Blob> => {
  const doc = <WowInvoicePDF invoice={invoice} patient={patient} practice={practice} />;
  return await pdf(doc).toBlob();
};

// Export function to download PDF
export const downloadInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice: PracticeInfo
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

export default WowInvoicePDF;