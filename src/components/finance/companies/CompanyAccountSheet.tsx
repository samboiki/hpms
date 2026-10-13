import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { AGE_BANDS } from '../../../services/ledgerService';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass } from '../receipts/ArUi';
import { formatDay, printDocument } from '../receipts/receiptDocuments';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { loadPracticeDetails, type PracticeDetails } from '../debtors/debtorsService';
import { patientFileLink } from '../debtors/accountText';
import { invoiceLink } from '../../billing/invoiceLinks';
import {
  closePayerAccount,
  loadAccountLedger,
  loadAccountMembers,
  loadInjuryCasesByIds,
  loadPatientNames,
  type AccountLedger
} from '../../../services/payerAccountService';
import { PAYER_KIND_LABELS, hasEmployees, type PayerAccount, type PayerMember } from '../../../utils/accounts/payerAccounts';
import type { InjuryCase } from '../../../utils/accounts/injuryCases';
import { caseNotesOf, companyInvoiceRows, companyStatement, companyStatementHtml } from './companyStatement';
import { CompanyEmployees } from './CompanyEmployees';
import { CompanyPaymentForm } from './CompanyPaymentForm';

const nad = (cents: number) => formatNad(fromCents(cents));

interface Loaded {
  ledger: AccountLedger;
  members: PayerMember[];
  cases: InjuryCase[];
  names: Record<string, string>;
}

interface CompanyAccountSheetProps {
  practiceId: string;
  account: PayerAccount;
  /** Every account of the practice (the employer's name on a case) */
  accounts: readonly PayerAccount[];
  todayKey: string;
  onClose: () => void;
  onEdit: () => void;
  /** A payment, an employee or the account changed: the lists read again */
  onChanged: () => void;
}

/**
 * One company or fund account (parity A14, A19): what it owes by age, its invoices (whose visit, which case), its
 * employees, its statement (print and CSV), money it paid, and closing it once it owes nothing.
 */
export const CompanyAccountSheet: React.FC<CompanyAccountSheetProps> = ({ practiceId, account, accounts, todayKey, onClose, onEdit, onChanged }) => {
  const id = useId();
  const role = useAuthStore(state => state.user?.role);
  const canClose = role === 'admin' || role === 'doctor';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [busy, setBusy] = useState<'print' | 'close' | null>(null);
  const [practice, setPractice] = useState<PracticeDetails | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const employees = hasEmployees(account.kind);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    (async () => {
      const [ledger, members] = await Promise.all([loadAccountLedger(account.id), employees ? loadAccountMembers(account.id) : Promise.resolve([] as PayerMember[])]);
      const caseIds = [...new Set(Object.values(ledger.caseOfVisit).filter((caseId): caseId is string => Boolean(caseId)))];
      const [cases, names] = await Promise.all([caseIds.length > 0 ? loadInjuryCasesByIds(caseIds) : Promise.resolve([] as InjuryCase[]), loadPatientNames(members.map(member => member.patientId))]);
      return { ledger, members, cases, names: { ...ledger.patientNames, ...names } };
    })()
      .then(result => {
        if (active) setLoaded(result);
      })
      .catch(failure => {
        if (active) setLoadError(failure instanceof Error ? failure.message : 'The account could not be read.');
      });
    return () => {
      active = false;
    };
  }, [account.id, employees, reloadKey]);

  useEffect(() => {
    let active = true;
    loadPracticeDetails(practiceId)
      .then(details => {
        if (active) setPractice(details);
      })
      .catch(failure => console.warn('The practice details for statements were not loaded:', failure));
    return () => {
      active = false;
    };
  }, [practiceId]);

  const accountNames = useMemo(() => Object.fromEntries(accounts.map(item => [item.id, item.name])), [accounts]);
  const rows = useMemo(() => (loaded ? companyInvoiceRows(loaded.ledger, loaded.cases, accountNames) : []), [loaded, accountNames]);
  const built = useMemo(() => (loaded ? companyStatement(account, loaded.ledger, { fromKey: null, asAtKey: todayKey }) : null), [loaded, account, todayKey]);
  const owedCents = rows.reduce((sum, row) => sum + row.owedCents, 0);
  const creditCents = built?.statement.closing.credit ?? 0;

  const changed = useCallback(
    (message: string) => {
      setNotice(message);
      setError(null);
      setReloadKey(key => key + 1);
      onChanged();
    },
    [onChanged]
  );
  const failed = useCallback((message: string) => setError(message), []);

  const print = () => {
    if (!built || !practice) return;
    setBusy('print');
    try {
      const html = companyStatementHtml(
        account,
        built,
        { practiceName: practice.name, contactPhone: practice.contactPhone, contactEmail: practice.contactEmail, payment: practice.payment, asAtKey: todayKey },
        caseNotesOf(rows)
      );
      if (!printDocument(html)) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      [
        { header: 'Invoice', type: 'text' },
        { header: 'Date', type: 'date' },
        { header: 'Patient', type: 'text' },
        { header: 'Case', type: 'text' },
        { header: 'Case details', type: 'text' },
        { header: 'Total', type: 'money' },
        { header: 'Still owed', type: 'money' }
      ],
      rows.map(row => [row.invoiceNumber, row.dateKey, row.patientName, row.caseTitle, row.caseDetails, fromCents(row.totalCents), fromCents(row.owedCents)])
    );
    downloadCsv(exportFileName(`${account.name} invoices ${todayKey}`), csv);
  };

  const close = async () => {
    if (closing === null || closing.trim().length < 3) return;
    setBusy('close');
    try {
      await closePayerAccount(account.id, closing.trim());
      toast.success(`${account.name} is closed. Its invoices and statements stay on record.`);
      onChanged();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The account could not be closed.');
    } finally {
      setBusy(null);
    }
  };

  const contact = [account.contactName, account.phone, account.email].filter(Boolean).join(' · ');
  const address = [account.postalAddress, [account.town, account.region].filter(Boolean).join(', ')].filter(Boolean).join(', ');

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy === 'close'}
      size="xl"
      icon="solar:buildings-2-bold-duotone"
      title={account.name}
      subtitle={`${PAYER_KIND_LABELS[account.kind]} · Account ${account.accountNumber}${account.closedAt ? ' · Closed' : ''}`}
      footer={
        <>
          <SecondaryButton icon="solar:download-minimalistic-bold-duotone" onClick={exportCsv} disabled={!loaded}>
            Invoices CSV
          </SecondaryButton>
          <SecondaryButton icon="solar:printer-minimalistic-bold-duotone" onClick={print} disabled={!built || !practice || busy !== null}>
            Print statement
          </SecondaryButton>
          {!account.closedAt && (
            <PrimaryButton icon="solar:hand-money-bold-duotone" onClick={() => setPaying(true)} disabled={!loaded || paying}>
              Record a payment
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {(notice || error) && (
          <div className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`} role={error ? 'alert' : 'status'}>
            {error ?? notice}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="min-w-0 space-y-0.5 text-sm text-gray-700">
            {contact && <p className="break-words">{contact}</p>}
            {address && <p className="break-words text-gray-500">{address}</p>}
            {account.registrationNumber && <p className="text-xs text-gray-500">Registration {account.registrationNumber}</p>}
            {account.vatNumber && <p className="text-xs text-gray-500">VAT {account.vatNumber}</p>}
            {account.closedAt && <p className="text-xs text-gray-500">Closed {formatDay(account.closedAt.slice(0, 10))}{account.closeReason ? `: ${account.closeReason}` : ''}</p>}
            {!contact && !address && <p className="text-gray-500">No contact details yet.</p>}
          </div>
          <SecondaryButton icon="solar:pen-bold-duotone" onClick={onEdit}>
            Change details
          </SecondaryButton>
        </div>

        {loadError ? (
          <ErrorBox>{loadError}</ErrorBox>
        ) : !loaded || !built ? (
          <div className="space-y-2" role="status" aria-label="Loading the account">
            {[0, 1, 2].map(index => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-1 rounded-xl border border-gray-200 bg-white p-4">
              <SummaryRow label="Owed on its invoices" value={nad(owedCents)} strong />
              {creditCents > 0 && <SummaryRow label="Paid and not yet used on an invoice" value={`-${nad(creditCents)}`} tone="good" />}
              <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4 lg:grid-cols-7">
                {AGE_BANDS.map(band => (
                  <div key={band.key} className="rounded-lg bg-gray-50 px-2 py-1.5">
                    <p className="text-xs text-gray-500">{band.label}</p>
                    <p className="text-sm font-medium tabular-nums text-gray-900">{nad(built.ages[band.key])}</p>
                  </div>
                ))}
              </div>
            </div>

            {paying && (
              <CompanyPaymentForm
                accountId={account.id}
                accountName={account.name}
                rows={rows}
                todayKey={todayKey}
                onCancel={() => setPaying(false)}
                onSaved={message => {
                  setPaying(false);
                  changed(message);
                }}
              />
            )}

            <section aria-labelledby={`${id}-invoices`} className="rounded-xl border border-gray-200 bg-white">
              <header className="border-b border-gray-100 px-4 py-3">
                <h3 id={`${id}-invoices`} className="text-sm font-semibold text-gray-900">
                  Invoices ({rows.length})
                </h3>
                <p className="text-xs text-gray-500">Every invoice of the visits billed to this account. Nothing on them is claimed from a medical aid.</p>
              </header>
              {rows.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-500">No visit is billed to this account yet. Bill one from the visit&apos;s Billing tab{employees ? ' once the patient is on the account' : ' under an injury or accident case'}.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <li key={row.invoiceId} className={`flex flex-wrap items-start justify-between gap-2 px-4 py-2 text-sm ${row.cancelled ? 'text-gray-400' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {/* The invoice in Finance's invoice view (its lines, payments, the visit) */}
                          <Link to={invoiceLink(row.invoiceId)} onClick={onClose} className="hover:text-cyan-700 hover:underline">
                            {row.invoiceNumber}
                          </Link>{' '}
                          · {formatDay(row.dateKey)}
                        </p>
                        <p className="break-words text-xs text-gray-500">
                          {row.patientId ? (
                            <Link to={patientFileLink(row.patientId)} className="text-cyan-700 hover:underline">
                              {row.patientName}
                            </Link>
                          ) : (
                            row.patientName
                          )}
                          {row.caseTitle ? ` · ${row.caseTitle}` : ''}
                        </p>
                        {row.caseDetails && <p className="break-words text-xs text-gray-500">{row.caseDetails}</p>}
                      </div>
                      <div className="text-right tabular-nums">
                        <p className={row.cancelled ? 'line-through' : 'text-gray-900'}>{nad(row.totalCents)}</p>
                        {row.owedCents > 0 && <p className="text-xs text-amber-700">{nad(row.owedCents)} owed</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {employees && (
              <CompanyEmployees
                practiceId={practiceId}
                accountId={account.id}
                accountName={account.name}
                members={loaded.members}
                names={loaded.names}
                closed={Boolean(account.closedAt)}
                onChanged={changed}
                onError={failed}
              />
            )}

            {!account.closedAt && canClose && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                {closing === null ? (
                  <button type="button" className="rounded text-sm font-medium text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500" onClick={() => setClosing('')}>
                    Close this account
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      An account closes once it owes nothing and no open case is billed to it. Its invoices and statements stay on record.
                    </p>
                    <Field label="Why it closes" htmlFor={`${id}-close`}>
                      <input id={`${id}-close`} className={inputClass} value={closing} maxLength={300} onChange={event => setClosing(event.target.value)} placeholder="For example: the company no longer pays for staff visits" />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      <SecondaryButton onClick={() => setClosing(null)} disabled={busy === 'close'}>
                        Keep open
                      </SecondaryButton>
                      <PrimaryButton tone="red" icon="solar:lock-keyhole-bold-duotone" onClick={() => void close()} busy={busy === 'close'} disabled={closing.trim().length < 3}>
                        Close the account
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
};

export default CompanyAccountSheet;
