/** Store pickers for a practice with more than one store (L10); nothing shows for a practice with one place */
import React from 'react';
import { storeChoices, type StockStore } from '../../utils/stock/stores';
import { Field } from './stockParts';
import { INPUT } from './stockUi';

/** A labelled store picker; `value` is a store key ('' = the main store) */
export const StorePicker: React.FC<{
  stores: readonly StockStore[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}> = ({ stores, value, onChange, label, hint, className, disabled }) => (
  <Field label={label} hint={hint} className={className}>
    {props => (
      <select {...props} value={value} onChange={event => onChange(event.target.value)} className={INPUT} disabled={disabled}>
        {storeChoices(stores, value || null).map(choice => <option key={choice.value || 'main'} value={choice.value}>{choice.label}</option>)}
      </select>
    )}
  </Field>
);
