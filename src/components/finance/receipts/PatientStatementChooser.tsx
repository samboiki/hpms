import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { useSeesFinanceFigures } from '../../../hooks/useScreenAccess';
import { invoiceLink } from '../../billing/invoiceLinks';
import PrintStatementModal from '../../modals/PrintStatementModal';
import { loadPatientBalances, loadPatientContact } from './arService';
import { PatientStatementDialog } from './PatientStatementDialog';

type InvoiceStatementInvoices = React.ComponentProps<typeof PrintStatementModal>['invoices'];

type Choice = { kind: 'checking' } | { kind: 'ledger'; practiceId: string; patientName: string } | { kind: 'invoices' };

/**
 * Which statement Manage invoices > Statement opens. Once receipts are in use it is the ledger statement, the same one
 * the account's own Statement button opens: part payments, receipts, credit notes and discounts count in every total
 * and every line opens its record. The older invoice statement left part-paid invoices out of every total and ignored
 * all of that, so a patient could be handed two statements with different figures. Before receipts are set up (or
 * without a practice) it stays the invoice statement, as before.
 */
export const PatientStatementChooser: React.FC<{ patientId: string; invoices: InvoiceStatementInvoices; onClose: () => void }> = ({ patientId, invoices, onClose }) => {
  const user = useAuthStore(state => state.user);
  const practiceId = user?.practice_id ?? null;
  const practiceName = user?.practices?.name || 'HPMS practice';
  const seesFinance = useSeesFinanceFigures();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<Choice>({ kind: 'checking' });

  useEffect(() => {
    if (!practiceId) {
      setChoice({ kind: 'invoices' });
      return;
    }
    let cancelled = false;
    Promise.all([
      // A failed check is not "not set up": the ledger statement then says what went wrong itself
      loadPatientBalances(patientId, practiceId).then(result => result.state).catch(() => 'ready' as const),
      loadPatientContact(practiceId, patientId).then(contact => contact.name).catch(() => 'Patient')
    ]).then(([state, patientName]) => {
      if (cancelled) return;
      setChoice(state === 'ready' ? { kind: 'ledger', practiceId, patientName } : { kind: 'invoices' });
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, practiceId]);

  if (choice.kind === 'checking') return null;
  if (choice.kind === 'invoices') return <PrintStatementModal isOpen onClose={onClose} patientId={patientId} invoices={invoices} />;
  // An invoice line opens the invoice in Finance for staff who open Finance; the table here lists it for everyone else
  const openInvoice = seesFinance ? (invoiceId: string) => navigate(invoiceLink(invoiceId)) : undefined;
  return (
    <PatientStatementDialog
      practiceId={choice.practiceId}
      practiceName={practiceName}
      patientId={patientId}
      patientName={choice.patientName}
      onClose={onClose}
      onOpenInvoice={openInvoice}
    />
  );
};

export default PatientStatementChooser;
