import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { ReceivePaymentDialog } from '../finance/receipts/ReceivePaymentDialog';
import { Sheet } from '../finance/receipts/ArUi';
import { loadPatientNames } from '../finance/debtors/debtorsService';

/**
 * "Invoice and take payment" on a visit's Billing tab (AddVisitTabs, EditVisitTabs): one action that
 * saves the visit, its invoice made exactly as the visit's save makes it, and then opens Receive
 * payment for that invoice with what the patient owes now (patientOwesNowCents). The screens show the
 * button only to staff who may raise the invoice and record the receipt (takePaymentProblem).
 */
export const InvoiceAndPayButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled = false }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-cyan-900">
      <span className="font-semibold">Paying now?</span> Save the visit with its invoice and take the payment in one step.
    </p>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
    >
      <Icon icon="solar:hand-money-bold-duotone" className="h-4 w-4" aria-hidden="true" />
      Invoice and take payment
    </button>
  </div>
);

interface VisitTakePaymentProps {
  practiceId: string;
  patientId: string;
  /** The invoice the visit's save created or updated */
  invoiceId: string;
  /** Receive payment closed (paid or not): the visit screen closes as after any save */
  onDone: () => void;
}

/** Receive payment for the visit's invoice, over the visit screen; the patient's name (printed on the receipt) is read first */
export const VisitTakePayment: React.FC<VisitTakePaymentProps> = ({ practiceId, patientId, invoiceId, onDone }) => {
  const user = useAuthStore(state => state.user);
  const [patientName, setPatientName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPatientNames(practiceId, [patientId])
      .then(names => { if (!cancelled) setPatientName(names[patientId] ?? 'Patient'); })
      .catch(error => {
        console.warn('Take payment: the patient name could not be read', error);
        if (!cancelled) setPatientName('Patient');
      });
    return () => { cancelled = true; };
  }, [practiceId, patientId]);

  if (patientName === null) {
    return (
      <Sheet open onClose={onDone} title="Opening Receive payment" icon="solar:hand-money-bold-duotone" size="md" overFullScreen>
        <p className="flex items-center gap-2 text-sm text-gray-600" role="status">
          <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          The visit and its invoice are saved. Opening the payment...
        </p>
      </Sheet>
    );
  }

  return (
    <ReceivePaymentDialog
      practiceId={practiceId}
      practiceName={user?.practices?.name || 'HPMS practice'}
      staffName={user?.name ?? null}
      initialPayer="patient"
      initialPatient={{ id: patientId, name: patientName }}
      focusInvoiceId={invoiceId}
      prefillPatientShare
      overFullScreen
      onClose={onDone}
    />
  );
};
