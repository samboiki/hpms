import React from 'react';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { lineRoomCents, sortLinesOldestFirst, type InvoiceLineOpen, type Portion } from '../../../services/ledgerService';
import { AmountInput } from './ArUi';

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * The lines of one invoice, each with what it can still take on this portion and an amount: staff choose what a
 * payment covers (the medicine, not the consultation the fund will pay). The lines' amounts make the payment on the
 * invoice; the database checks the same limits (ar_insert_allocation_lines).
 */
export const AllocationLinePicker: React.FC<{
  idPrefix: string;
  invoiceNumber: string;
  portion: Portion;
  lines: readonly InvoiceLineOpen[];
  /** Typed amounts by line id */
  values: Readonly<Record<string, string>>;
  /** What is wrong with a line, by line id */
  errors: Readonly<Record<string, string>>;
  disabled?: boolean;
  onChange: (lineId: string, value: string) => void;
}> = ({ idPrefix, invoiceNumber, portion, lines, values, errors, disabled = false, onChange }) => (
  <ul className="mt-2 space-y-2 rounded-lg bg-gray-50 p-2" aria-label={`Lines of ${invoiceNumber}`}>
    {sortLinesOldestFirst(lines).map(line => {
      const room = lineRoomCents(line, portion);
      const id = `${idPrefix}-${line.lineId}`;
      const error = errors[line.lineId];
      return (
        <li key={line.lineId} className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_9rem] sm:items-center">
          <label htmlFor={id} className="min-w-0 text-xs text-gray-700">
            <span className="font-mono text-cyan-700">{line.code || 'Line'}</span>
            {line.description && <span className="text-gray-600"> {line.description}</span>}
            <span className="block text-gray-500">
              {line.dateKey ? `${formatServiceDate(line.dateKey)} · ` : ''}
              {room > 0 ? `${nad(room)} unpaid` : 'Nothing unpaid on this line'}
            </span>
          </label>
          <div>
            <AmountInput
              id={id}
              value={values[line.lineId] ?? ''}
              onChange={event => onChange(line.lineId, event.target.value)}
              placeholder="0.00"
              invalid={!!error}
              disabled={disabled || (room <= 0 && !(values[line.lineId] ?? '').trim())}
            />
            {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
          </div>
        </li>
      );
    })}
  </ul>
);
