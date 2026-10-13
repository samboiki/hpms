import React, { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { pdfBase64, renderFinanceDocumentPdf } from '../receipts/documentPdf';
import { loadLetterhead } from '../../quotes/quoteService';
import type { PracticeLetterhead } from '../../quotes/quotePdf';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { loadFunds } from './claimsService';
import { emailFundStatement, fundRecipients, fundStatementMessage } from './fundStatementEmail';
import { fundName, fundStatementPdfModel } from './fundStatementPdf';
import type { FundStatement } from './fundStatement';
import type { FundProvider, PracticeInfo } from './types';

interface FundStatementEmailSheetProps {
  practice: PracticeInfo;
  statement: FundStatement;
  asOfKey: string;
  onClose: () => void;
}

/**
 * "Email to the fund" on the statement of outstanding claims (parity F22): the statement as a PDF to the fund's claims
 * address from the fund master, through the practice's email gateway (logged with every other email). Staff see the
 * address, the message and the attachment, and confirm before anything is sent.
 */
const FundStatementEmailSheet: React.FC<FundStatementEmailSheetProps> = ({ practice, statement, asOfKey, onClose }) => {
  const id = useId();
  const [funds, setFunds] = useState<FundProvider[] | null>(null);
  const [letterhead, setLetterhead] = useState<PracticeLetterhead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadFunds(), loadLetterhead(practice.id)])
      .then(([fundList, practiceLetterhead]) => {
        if (!live) return;
        setFunds(fundList);
        setLetterhead(practiceLetterhead);
      })
      .catch((error: unknown) => {
        if (live) setLoadError(error instanceof Error ? error.message : 'The fund or the practice details could not be read.');
      });
    return () => {
      live = false;
    };
  }, [practice.id]);

  const recipients = useMemo(() => (funds ? fundRecipients(statement, funds) : []), [funds, statement]);
  const recipient = recipients.find(item => item.email === chosen) ?? recipients[0] ?? null;
  const message = useMemo(() => fundStatementMessage(statement, asOfKey, practice), [statement, asOfKey, practice]);
  const model = useMemo(() => (letterhead ? fundStatementPdfModel(statement, asOfKey, letterhead) : null), [letterhead, statement, asOfKey]);
  const sent = result?.ok === true;

  const send = async () => {
    if (!recipient || !model || !confirmed || sending || sent) return;
    setSending(true);
    try {
      setResult(await emailFundStatement({ practice, statement, recipient, message, attachment: { fileName: model.fileName, base64: pdfBase64(renderFinanceDocumentPdf(model)) } }));
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'The statement could not be emailed.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={sending}
      size="md"
      title={`Email the statement to ${fundName(statement)}`}
      subtitle="Sent as a PDF through the practice's email gateway, to the fund's claims address"
      icon="solar:letter-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={sending}>{sent ? 'Close' : 'Cancel'}</SecondaryButton>
          {!sent && (
            <PrimaryButton icon="solar:letter-bold-duotone" busy={sending} disabled={!recipient || !model || !confirmed} onClick={() => void send()}>
              {sending ? 'Sending...' : 'Send to the fund'}
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {loadError ? (
          <ErrorBox>{loadError}</ErrorBox>
        ) : funds === null || !letterhead ? (
          <p className="text-sm text-gray-500" role="status">Preparing the email...</p>
        ) : recipients.length === 0 ? (
          <ErrorBox>
            {fundName(statement)} has no claims email address on record. OneHealth support keeps it (Administration &gt; Medical aid funds). Print or
            download the statement for the fund instead.
          </ErrorBox>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <MedicalAidLogo name={fundName(statement)} size="md" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-gray-900">{fundName(statement)}</p>
                <p className="text-gray-500">{statement.claimCount} claim(s) outstanding</p>
              </div>
            </div>
            {recipients.length > 1 ? (
              <Field label="To" htmlFor={`${id}-to`} hint="The fund's claims addresses from the fund master">
                <select id={`${id}-to`} className={inputClass} value={recipient?.email ?? ''} onChange={event => setChosen(event.target.value)} disabled={sending || sent}>
                  {recipients.map(item => <option key={item.email} value={item.email}>{item.label}: {item.email}</option>)}
                </select>
              </Field>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500">To</dt>
                <dd className="min-w-0 break-words font-medium text-gray-900">{recipient?.label}: {recipient?.email}</dd>
              </dl>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-500">Subject</dt>
              <dd className="min-w-0 break-words text-gray-900">{message.subject}</dd>
              <dt className="text-gray-500">Attached</dt>
              <dd className="flex min-w-0 items-center gap-1 break-all text-gray-900">
                <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
                {model?.fileName}
              </dd>
            </dl>
            <div className="whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{message.text}</div>
            {!sent && (
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={sending} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                <span>I checked the statement: send it to the fund now.</span>
              </label>
            )}
          </>
        )}
        {result && (
          result.ok ? (
            <p className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">
              <Icon icon="solar:check-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {result.message}
            </p>
          ) : (
            <ErrorBox>{result.message}</ErrorBox>
          )
        )}
      </div>
    </Sheet>
  );
};

export default FundStatementEmailSheet;
