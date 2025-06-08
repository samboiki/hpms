// Billing Types for HPMS System
// Integrates with dental practice codes and medical aid processing

export interface ServiceSelection {
  id: string;
  tariffId: string;
  code: string;
  description: string;
  category: string;
  subcategory?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  notes?: string;
  requiresPreAuth?: boolean;
  medicalAidCovered?: boolean;
  coveragePercentage?: number;
}

export interface TariffCode {
  id: string;
  code: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  practiceType: string;
  unit: 'per_visit' | 'per_tooth' | 'per_treatment' | 'per_film' | 'per_surface';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresPreAuth: boolean;
  medicalAidCode?: string;
  notes?: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  visitId: string;
  practiceId: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: 'cash' | 'card' | 'eft' | 'medical_aid' | 'mixed';
  medicalAidClaimNumber?: string;
  medicalAidStatus?: 'not_submitted' | 'submitted' | 'approved' | 'rejected' | 'partial';
  medicalAidAmount?: number;
  patientAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  tariffCodeId: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  medicalAidCovered: boolean;
  medicalAidAmount?: number;
  patientAmount?: number;
  notes?: string;
}

export interface MedicalAidCoverage {
  id: string;
  medicalAidId: string;
  tariffCode: string;
  coveragePercentage: number;
  maxAmount?: number;
  waitingPeriodDays: number;
  requiresPreAuth: boolean;
  isActive: boolean;
}

export interface BillingCalculation {
  services: ServiceSelection[];
  subtotal: number;
  tax: number;
  total: number;
  medicalAidTotal: number;
  patientTotal: number;
  hasUncoveredServices: boolean;
  requiresPreAuthorization: boolean;
  preAuthServices: ServiceSelection[];
}

export interface PracticeSettings {
  id: string;
  practiceId: string;
  taxRate: number;
  defaultPaymentTerms: number; // days
  invoicePrefix: string;
  autoGenerateInvoices: boolean;
  requirePaymentOnService: boolean;
  acceptMedicalAid: boolean;
  settings: {
    emailInvoices: boolean;
    smsReminders: boolean;
    lateFees: boolean;
    lateFeePercentage?: number;
    gracePeriodDays?: number;
  };
}

// Service selector props
export interface ServiceSelectorProps {
  practiceId: string;
  selectedServices: ServiceSelection[];
  onServiceChange: (services: ServiceSelection[]) => void;
  medicalAidId?: string;
  readOnly?: boolean;
}

// Invoice generation request
export interface InvoiceGenerationRequest {
  visitId: string;
  patientId: string;
  practiceId: string;
  services: ServiceSelection[];
  medicalAidId?: string;
  notes?: string;
  generatePdf?: boolean;
  emailToPatient?: boolean;
}

// Payment processing
export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'eft' | 'medical_aid';
  paymentDate: string;
  reference?: string;
  notes?: string;
  processedBy: string;
}

export default {};