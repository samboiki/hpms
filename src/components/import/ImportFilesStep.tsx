import React, { useCallback, useId, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Icon } from '@iconify/react';
import { formatServiceDate } from '../../utils/billing/dates';
import type { BalancePortion } from '../../utils/import/eminanceBalances';
import { fileNeeds, usesOf, withUse, type FileUse, type ImportFile } from '../../utils/import/importFiles';
import { Notice } from '../finance/FinanceUI';
import { inputClass, PrimaryButton } from '../finance/receipts/ArUi';
import { balancesDateProblem, count, oldestBalancesDate, plural, PORTION_LABELS, USE_LABELS } from './importText';
import { StepIntro } from './importUi';

interface ImportFilesStepProps {
  files: readonly ImportFile[];
  /** Files still being read */
  reading: number;
  onAdd: (files: File[]) => void;
  onChange: (file: ImportFile) => void;
  onRemove: (index: number) => void;
  hasBalances: boolean;
  balancesAsOf: string;
  onBalancesAsOf: (value: string) => void;
  today: string;
}

const ACCEPT = {
  'text/csv': ['.csv'],
  'text/plain': ['.txt', '.dat'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

const contentsOf = (file: ImportFile): string => {
  if (file.source === 'claims') {
    return `${plural(file.claimLines.length, 'claim line', 'claim lines')}${file.ignoredLines ? ` (${count(file.ignoredLines)} could not be read)` : ''}`;
  }
  return file.table ? plural(file.table.rows.length, 'row', 'rows') : '';
};

const FileCard: React.FC<{ file: ImportFile; onChange: (file: ImportFile) => void; onRemove: () => void }> = ({ file, onChange, onRemove }) => {
  const kindId = useId();
  const portionId = useId();
  const needs = fileNeeds(file);
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Icon icon={file.source === 'claims' ? 'solar:bill-list-bold-duotone' : 'solar:file-text-bold-duotone'} className="mt-0.5 h-6 w-6 flex-none text-cyan-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="break-all font-medium text-gray-900">{file.name}</p>
          <p className="text-xs text-gray-500">{contentsOf(file)}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          aria-label={`Remove ${file.name}`}
        >
          <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {file.problem ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-red-700">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {file.problem}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor={kindId} className="mb-1 block text-sm font-medium text-gray-700">What is this file?</label>
            <select id={kindId} className={inputClass} value={file.use} onChange={event => onChange(withUse(file, event.target.value as FileUse))}>
              {usesOf(file).map(use => <option key={use} value={use}>{USE_LABELS[use]}</option>)}
            </select>
          </div>
          {file.use === 'balances' && (
            <div>
              <label htmlFor={portionId} className="mb-1 block text-sm font-medium text-gray-700">Which amounts are in it?</label>
              <select id={portionId} className={inputClass} value={file.portion} onChange={event => onChange({ ...file, portion: event.target.value as BalancePortion })}>
                {(Object.keys(PORTION_LABELS) as BalancePortion[]).map(portion => <option key={portion} value={portion}>{PORTION_LABELS[portion]}</option>)}
              </select>
            </div>
          )}
          {file.use === 'ignore' && file.source === 'table' && (
            <p className="self-end text-xs text-gray-500">Its headings were not recognised. Choose what it is to use it.</p>
          )}
          {needs.length > 0 && <p className="text-xs text-amber-800 md:col-span-2">Match in the next step: {needs.join(', ')}.</p>}
        </div>
      )}
    </li>
  );
};

/** Step 1: the files exported from Eminance, what each one is, and the day the balances were run */
export const ImportFilesStep: React.FC<ImportFilesStepProps> = ({ files, reading, onAdd, onChange, onRemove, hasBalances, balancesAsOf, onBalancesAsOf, today }) => {
  const dateId = useId();
  const [rejected, setRejected] = useState<string[]>([]);
  const onDrop = useCallback((accepted: File[], refused: FileRejection[]) => {
    setRejected(refused.map(item => item.file.name));
    if (accepted.length > 0) onAdd(accepted);
  }, [onAdd]);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, noClick: true, multiple: true, accept: ACCEPT });
  const dateProblem = hasBalances ? balancesDateProblem(balancesAsOf, today) : null;

  return (
    <div className="space-y-5">
      <StepIntro title="Choose the files you exported from Eminance">
        Each file is recognised by its headings. The files are read on this device: nothing is saved until you import.
      </StepIntro>

      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center motion-safe:transition-colors sm:p-8 ${isDragActive ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300 bg-white'}`}
      >
        <input {...getInputProps()} aria-label="Files exported from Eminance" />
        <Icon icon="solar:cloud-upload-bold-duotone" className="mx-auto mb-3 h-12 w-12 text-cyan-500" aria-hidden="true" />
        <p className="font-medium text-gray-900">Drop the files here</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">Excel (.xlsx, .xls), CSV, or claim files (.Dat). Several at once is fine.</p>
        <div className="mt-4">
          <PrimaryButton icon="solar:folder-open-bold-duotone" onClick={open}>Choose files</PrimaryButton>
        </div>
      </div>

      <div role="status" aria-live="polite" className="space-y-2">
        {reading > 0 && <p className="text-sm text-gray-600">Reading {plural(reading, 'file', 'files')}...</p>}
        {rejected.length > 0 && (
          <Notice tone="warning">Not read (only Excel, CSV and .Dat files): {rejected.join(', ')}</Notice>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-3" aria-label="Files">
          {files.map(file => (
            <FileCard key={file.index} file={file} onChange={onChange} onRemove={() => onRemove(file.index)} />
          ))}
        </ul>
      )}

      {hasBalances && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <label htmlFor={dateId} className="mb-1 block text-sm font-medium text-gray-700">Balances as at</label>
          <input
            id={dateId}
            type="date"
            className={`${inputClass} sm:max-w-xs`}
            value={balancesAsOf}
            min={oldestBalancesDate(today)}
            max={today}
            onChange={event => onBalancesAsOf(event.target.value)}
            aria-describedby={`${dateId}-hint`}
            aria-invalid={dateProblem ? true : undefined}
          />
          <p id={`${dateId}-hint`} className={`mt-1 text-xs ${dateProblem ? 'text-red-600' : 'text-gray-500'}`}>
            {dateProblem ?? `The day the age analysis was run in Eminance (${formatServiceDate(balancesAsOf)}). Each balance is dated back from it, so it shows at the same age in OneHealth.`}
          </p>
        </div>
      )}

      <details className="group rounded-xl border border-gray-200 bg-white" open={files.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:p-4">
          <Icon icon="solar:question-circle-bold-duotone" className="h-5 w-5 flex-none text-cyan-600" aria-hidden="true" />
          <span className="flex-1 font-medium text-gray-900">What to export from Eminance</span>
          <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4 text-gray-400 group-open:rotate-180 motion-safe:transition-transform" aria-hidden="true" />
        </summary>
        <div className="space-y-3 border-t border-gray-100 p-3 text-sm text-gray-700 sm:p-4">
          <p><span className="font-semibold">Patient list</span>: every patient with the account number, the dependant number or code, names, ID number, date of birth, sex, cell number, email, medical aid, membership number and relationship. Excel or CSV.</p>
          <p><span className="font-semibold">Age analysis</span> (for the balances): every account with Current, 30, 60, 90, 120, 150 and 180+ days and Unallocated. Run it on the day you stop billing in Eminance. To keep who owes what, export it twice: medical aid portion only, and patient portion only.</p>
          <p><span className="font-semibold">Recall list</span> (if you use recalls): account, dependant, recall date and reason.</p>
          <p><span className="font-semibold">Claim history</span> (optional): the .Dat claim files in Eminance&apos;s History folder. They hold medical aid claims only.</p>
          <Notice tone="info">
            Eminance does not export private invoices or payments, so visit and invoice history is not brought over: each account&apos;s balance is, by
            age. Claim files add read-only medical aid claim history to the patient&apos;s file.
          </Notice>
        </div>
      </details>
    </div>
  );
};
