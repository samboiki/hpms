import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { DANGER, INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { parseBarcodeList } from '../../utils/optometry/frameUnits';

/**
 * The small dialogs for one frame (a barcode): put it aside for someone, write it off as lost or damaged, change who
 * sold it, and give barcodes to frames on the shelf that have none. They look like the optometry ReasonSheet.
 */

interface SheetFormProps {
  open: boolean;
  formId: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  error: string | null;
  initialFocus?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

const SheetForm: React.FC<SheetFormProps> = ({ open, formId, title, subtitle, confirmLabel, danger, busy, error, initialFocus, onClose, onSubmit, children }) => (
  <ListSheet
    open={open}
    onClose={onClose}
    title={title}
    subtitle={subtitle}
    dismissible={!busy}
    initialFocus={initialFocus}
    footer={
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {error && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{error}</p>}
        <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
          Back
        </button>
        <button type="submit" form={formId} className={danger ? DANGER : PRIMARY} disabled={busy}>
          {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    }
  >
    <form
      id={formId}
      noValidate
      className="space-y-3"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  </ListSheet>
);

/** Runs a step, keeps the dialog open with the database's message when it fails */
function useStep(open: boolean) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  const run = async (step: () => Promise<void>, onDone: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await step();
      onDone();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const NOTE_LIMIT = 200;

// ---------------------------------------------------------------------------------------------------
// Put aside
// ---------------------------------------------------------------------------------------------------

export const HoldSheet: React.FC<{ open: boolean; barcode: string; onClose: () => void; onConfirm: (note: string) => Promise<void> }> = ({ open, barcode, onClose, onConfirm }) => {
  const [note, setNote] = useState('');
  const step = useStep(open);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  const submit = () => {
    const text = note.trim();
    if (!text) return step.setError('Say who it is put aside for.');
    if (text.length > NOTE_LIMIT) return step.setError(`Keep it to ${NOTE_LIMIT} characters.`);
    void step.run(() => onConfirm(text), onClose);
  };
  return (
    <SheetForm
      open={open}
      formId="frame-hold-form"
      title={`Put aside ${barcode}`}
      subtitle="The frame stays in stock but is kept for someone. Put it back on the shelf when they do not take it."
      confirmLabel="Put aside"
      busy={step.busy}
      error={step.error}
      initialFocus={inputRef}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="Who it is for, and until when">
        {props => <input {...props} ref={inputRef} className={INPUT} value={note} maxLength={NOTE_LIMIT} placeholder="Mrs N, until Friday" onChange={event => setNote(event.target.value)} />}
      </Field>
    </SheetForm>
  );
};

// ---------------------------------------------------------------------------------------------------
// Lost or damaged
// ---------------------------------------------------------------------------------------------------

type WriteOff = 'lost' | 'damaged';

export const WriteOffSheet: React.FC<{ open: boolean; barcode: string; onClose: () => void; onConfirm: (code: WriteOff, note: string) => Promise<void> }> = ({
  open,
  barcode,
  onClose,
  onConfirm
}) => {
  const [code, setCode] = useState<WriteOff>('lost');
  const [note, setNote] = useState('');
  const step = useStep(open);
  useEffect(() => {
    if (open) {
      setCode('lost');
      setNote('');
    }
  }, [open]);
  const submit = () => {
    const text = note.trim();
    if (text.length < 3) return step.setError('Describe what happened (it is kept with the frame).');
    if (text.length > NOTE_LIMIT) return step.setError(`Keep it to ${NOTE_LIMIT} characters.`);
    void step.run(() => onConfirm(code, text), onClose);
  };
  return (
    <SheetForm
      open={open}
      formId="frame-write-off-form"
      title={`Write off ${barcode}`}
      subtitle="The frame comes off the stock count (a stock adjustment), with who did it and why. If it turns up, use Found it."
      confirmLabel="Write off"
      danger
      busy={step.busy}
      error={step.error}
      onClose={onClose}
      onSubmit={submit}
    >
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-gray-700">What happened</legend>
        <div className="flex flex-wrap gap-2">
          {(['lost', 'damaged'] as const).map(option => (
            <label key={option} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${code === option ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700'}`}>
              <input type="radio" name="frame-write-off" className="h-4 w-4 text-cyan-600 focus:ring-cyan-500" checked={code === option} onChange={() => setCode(option)} />
              {option === 'lost' ? 'Lost or stolen' : 'Damaged'}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Details">
        {props => (
          <textarea {...props} rows={3} className={INPUT} value={note} maxLength={NOTE_LIMIT} placeholder={code === 'lost' ? 'Not on the wall at the count of 12 Oct' : 'Hinge broke while adjusting'} onChange={event => setNote(event.target.value)} />
        )}
      </Field>
    </SheetForm>
  );
};

// ---------------------------------------------------------------------------------------------------
// Who sold it
// ---------------------------------------------------------------------------------------------------

export const SellerSheet: React.FC<{
  open: boolean;
  barcode: string;
  staff: ReadonlyArray<{ id: string; name: string }>;
  current: string | null;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<void>;
}> = ({ open, barcode, staff, current, onClose, onConfirm }) => {
  const [userId, setUserId] = useState('');
  const step = useStep(open);
  useEffect(() => {
    if (open) setUserId(current ?? '');
  }, [open, current]);
  const submit = () => {
    if (!userId) return step.setError('Choose the staff member who sold it.');
    void step.run(() => onConfirm(userId), onClose);
  };
  return (
    <SheetForm
      open={open}
      formId="frame-seller-form"
      title={`Who sold ${barcode}`}
      subtitle="The salesperson counts in the frame sales report. The change is kept in the frame's history."
      confirmLabel="Save"
      busy={step.busy}
      error={step.error}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="Sold by">
        {props => (
          <select {...props} className={INPUT} value={userId} onChange={event => setUserId(event.target.value)}>
            <option value="">Choose</option>
            {staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        )}
      </Field>
    </SheetForm>
  );
};

// ---------------------------------------------------------------------------------------------------
// Barcodes for frames on the shelf without one
// ---------------------------------------------------------------------------------------------------

export const AddBarcodesSheet: React.FC<{
  open: boolean;
  frameName: string;
  /** Frames on the shelf (the stock count) without a barcode */
  missing: number;
  onClose: () => void;
  onConfirm: (barcodes: string[], count: number) => Promise<void>;
}> = ({ open, frameName, missing, onClose, onConfirm }) => {
  const [scanned, setScanned] = useState('');
  const step = useStep(open);
  useEffect(() => {
    if (open) setScanned('');
  }, [open]);
  const list = parseBarcodeList(scanned);
  const submit = () => {
    if (list.invalid.length > 0) return step.setError(`Not a barcode: ${list.invalid.slice(0, 3).join(', ')}. Letters, digits and dashes, 4 to 40.`);
    if (list.repeated.length > 0) return step.setError(`Scanned twice: ${list.repeated.slice(0, 3).join(', ')}.`);
    if (list.barcodes.length > missing) return step.setError(`Only ${missing} frame${missing === 1 ? ' has' : 's have'} no barcode.`);
    void step.run(() => onConfirm(list.barcodes, list.barcodes.length > 0 ? list.barcodes.length : missing), onClose);
  };
  return (
    <SheetForm
      open={open}
      formId="frame-add-barcodes-form"
      title="Give frames a barcode"
      subtitle={`${frameName}: ${missing} on the shelf without a barcode.`}
      confirmLabel={list.barcodes.length > 0 ? `Save ${list.barcodes.length} barcode${list.barcodes.length === 1 ? '' : 's'}` : `Give ${missing} the practice's numbers`}
      busy={step.busy}
      error={step.error}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="The frames' own barcodes (optional)" hint="Scan each frame's tag. Leave empty and the practice's own numbers (FR...) are given: print their labels afterwards.">
        {props => <textarea {...props} rows={4} className={INPUT} value={scanned} onChange={event => setScanned(event.target.value)} />}
      </Field>
    </SheetForm>
  );
};
