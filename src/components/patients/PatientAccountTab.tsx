/**
 * The patient file's Account tab, next to Billing (owner, 15 Oct 2026: Billing shows only his own design, and what was
 * added since lives here): claims a fund did not pay, the account (balance, payments and receipts, the statement,
 * flags and family, payment plans, prepaid packages, referrals, authorisations, injury and accident cases, the price
 * rate) and quotes. The parts keep their own look; this tab only stacks them.
 */
import React from 'react';
import { PatientClaimsNotice } from '../finance/remittances/PatientClaimsNotice';
import PatientBillingPanel, { type BillingVisitInfo } from './PatientBillingPanel';
import { PatientQuotesPanel } from '../quotes/QuotePanels';
import type { PatientInvoicesResult } from './usePatientInvoices';

interface PatientAccountTabProps {
  practiceId: string | null | undefined;
  patient: { id: string; name: string; phone: string | null; email: string | null };
  medicalAidProvider?: string | null;
  /** The patient's invoices behind the balance (usePatientInvoices) */
  invoices: PatientInvoicesResult;
  visitsById: Map<string, BillingVisitInfo>;
  onOpenVisit: (visitId: string) => void;
  /** When an account alert beside the patient's name was tapped (Date.now()): the account comes into view */
  accountFocusKey?: number;
}

const PatientAccountTab: React.FC<PatientAccountTabProps> = ({
  practiceId,
  patient,
  medicalAidProvider,
  invoices,
  visitsById,
  onOpenVisit,
  accountFocusKey = 0
}) => (
  <div className="space-y-6">
    {/* Claims a fund did not pay that still need someone, one tap to the rejection queue */}
    <PatientClaimsNotice practiceId={practiceId} patientId={patient.id} />
    <PatientBillingPanel
      invoices={invoices}
      visitsById={visitsById}
      patient={{ name: patient.name, phone: patient.phone, email: patient.email }}
      medicalAidProvider={medicalAidProvider}
      onOpenVisit={onOpenVisit}
      accountFocusKey={accountFocusKey}
    />
    {/* Quotes (treatment estimates): create, send, accept and convert to an invoice */}
    <PatientQuotesPanel practiceId={practiceId} patient={patient} />
  </div>
);

export default PatientAccountTab;
