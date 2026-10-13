import React, { useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { saveDocumentSettings } from '../../../services/documentSettingsService';
import { DOCUMENT_KIND_LABELS, DOCUMENT_MESSAGE_MAX, checkDocumentSettings, type DocumentKind, type DocumentSettings } from '../../../utils/billing/documentSettings';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';

const KINDS: readonly DocumentKind[] = ['invoice', 'quote', 'statement'];

interface DocumentSettingsSheetProps {
  practiceId: string;
  settings: DocumentSettings;
  /** Practice administrators change them (the database refuses anyone else); everyone else sees them */
  canEdit: boolean;
  onClose: () => void;
  onSaved: (settings: DocumentSettings) => void;
}

/**
 * The practice's message on its invoices, quotes and statements (parity D22) and whether statements leave settled
 * items off unless a run chooses otherwise (parity D26), in the look of the statement run criteria sheet.
 */
export const DocumentSettingsSheet: React.FC<DocumentSettingsSheetProps> = ({ practiceId, settings, canEdit, onClose, onSaved }) => {
  const [draft, setDraft] = useState<DocumentSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !canEdit || busy;

  const save = async () => {
    const check = checkDocumentSettings(draft);
    if (!check.ok) { setError(check.error); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveDocumentSettings(practiceId, draft);
      toast.success('Saved for the whole practice');
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'Not saved');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title="Messages and statement settings" subtitle="For the whole practice" icon="solar:settings-bold-duotone"
      footer={canEdit ? (
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton>
          <PrimaryButton onClick={() => void save()} busy={busy}>Save</PrimaryButton>
        </>
      ) : (
        <PrimaryButton icon="solar:check-circle-bold-duotone" onClick={onClose}>Done</PrimaryButton>
      )}>
      <div className="space-y-4">
        {!canEdit && <p className="text-sm text-gray-600">Only a practice administrator can change these.</p>}
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Message on the practice's documents (optional)" htmlFor="document-message"
          hint={`For example: accounts are payable within 30 days. ${draft.message.length}/${DOCUMENT_MESSAGE_MAX}`}>
          <textarea id="document-message" rows={3} className={inputClass} value={draft.message} maxLength={DOCUMENT_MESSAGE_MAX} disabled={locked}
            onChange={event => setDraft(current => ({ ...current, message: event.target.value }))} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Print it on</legend>
          <div className="flex flex-wrap gap-3">
            {KINDS.map(kind => (
              <label key={kind} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={draft.printOn[kind]} disabled={locked}
                  onChange={() => setDraft(current => ({ ...current, printOn: { ...current.printOn, [kind]: !current.printOn[kind] } }))} />
                {DOCUMENT_KIND_LABELS[kind]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600" checked={draft.leaveSettledOff} disabled={locked}
            onChange={() => setDraft(current => ({ ...current, leaveSettledOff: !current.leaveSettledOff }))} />
          <span>
            Leave settled items off statements
            <span className="block text-xs text-gray-500">Paid invoices, and the payments that settled them, are not printed, so statements stay short. The balance is the same either way, and each statement run can choose otherwise.</span>
          </span>
        </label>
      </div>
    </Sheet>
  );
};
