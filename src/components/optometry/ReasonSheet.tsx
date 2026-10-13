import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { DANGER, INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';

interface ReasonSheetProps {
  open: boolean;
  title: string;
  /** What the step does, in one sentence */
  description: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/** Asks why before a step that needs a reason: a remake, a cancellation, a prescription entered in error. */
const ReasonSheet: React.FC<ReasonSheetProps> = ({ open, title, description, label, placeholder, confirmLabel, danger, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError('Say why in a few words.');
      return;
    }
    if (text.length > 200) {
      setError('Keep it to 200 characters.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(text);
      onClose();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      dismissible={!busy}
      initialFocus={inputRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Back
          </button>
          <button type="submit" form="optometry-reason-form" className={danger ? DANGER : PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <form id="optometry-reason-form" onSubmit={confirm} noValidate>
        <Field label={label} error={error ?? undefined}>
          {props => (
            <textarea
              {...props}
              ref={inputRef}
              rows={3}
              maxLength={200}
              className={INPUT}
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder={placeholder}
            />
          )}
        </Field>
      </form>
    </ListSheet>
  );
};

export default ReasonSheet;
