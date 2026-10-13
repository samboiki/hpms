import React, { useId } from 'react';
import { Icon } from '@iconify/react';
import { cellText } from '../../utils/billing/tariffImport';
import { FIELDS, type FieldDefinition } from '../../utils/import/eminanceFields';
import { fileNeeds, type ImportFile } from '../../utils/import/importFiles';
import { Notice, SectionCard } from '../finance/FinanceUI';
import { inputClass } from '../finance/receipts/ArUi';
import { USE_LABELS } from './importText';
import { StepIntro } from './importUi';

interface ImportColumnsStepProps {
  files: readonly ImportFile[];
  onChange: (file: ImportFile) => void;
}

/** The first value under a column, so staff can see what it holds */
const exampleOf = (file: ImportFile, column: number | undefined): string => {
  if (column === undefined || !file.table) return '';
  const row = file.table.rows.find(item => cellText(item.cells[column]).trim() !== '');
  return row ? cellText(row.cells[column]).trim().slice(0, 40) : '';
};

const FieldRow: React.FC<{ file: ImportFile; field: FieldDefinition; onChange: (file: ImportFile) => void }> = ({ file, field, onChange }) => {
  const id = useId();
  const column = file.mapping[field.key];
  const example = exampleOf(file, column);
  const change = (value: string) => {
    const mapping = { ...file.mapping };
    if (value === '') delete mapping[field.key];
    else mapping[field.key] = Number(value);
    onChange({ ...file, mapping });
  };
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-center sm:gap-3">
      <label htmlFor={id} className="text-sm text-gray-700">{field.label}</label>
      <div className="min-w-0">
        <select id={id} className={inputClass} value={column === undefined ? '' : String(column)} onChange={event => change(event.target.value)} aria-describedby={example ? `${id}-example` : undefined}>
          <option value="">Not in this file</option>
          {(file.table?.headers ?? []).map((header, index) => (
            <option key={index} value={index}>{header.trim() || `Column ${index + 1}`}</option>
          ))}
        </select>
        {example && <p id={`${id}-example`} className="mt-0.5 truncate text-xs text-gray-500">First value: {example}</p>}
      </div>
    </div>
  );
};

const FileColumns: React.FC<{ file: ImportFile; onChange: (file: ImportFile) => void }> = ({ file, onChange }) => {
  if (file.use === 'ignore' || file.use === 'claims') return null;
  const kind = file.use;
  const fields = FIELDS.filter(field => field.kinds.includes(kind));
  const main = fields.filter(field => !field.extra);
  const extra = fields.filter(field => field.extra);
  const needs = fileNeeds(file);
  const mappedExtra = extra.filter(field => file.mapping[field.key] !== undefined).length;
  return (
    <SectionCard title={file.name} subtitle={USE_LABELS[kind]} icon="solar:list-check-bold-duotone" tone={needs.length ? 'amber' : 'cyan'}>
      <div className="space-y-4">
        {needs.length > 0 ? (
          <Notice tone="warning" title="Choose the columns that hold">{needs.join(', ')}.</Notice>
        ) : (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Every column it needs was found. Check the matches below.
          </p>
        )}
        <div className="space-y-3">
          {main.map(field => <FieldRow key={field.key} file={file} field={field} onChange={onChange} />)}
        </div>
        {extra.length > 0 && (
          <details className="group rounded-lg border border-gray-200">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
              <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4 text-gray-400 group-open:rotate-180 motion-safe:transition-transform" aria-hidden="true" />
              More columns ({mappedExtra} of {extra.length} matched)
            </summary>
            <div className="space-y-3 border-t border-gray-100 p-3">
              {extra.map(field => <FieldRow key={field.key} file={file} field={field} onChange={onChange} />)}
            </div>
          </details>
        )}
      </div>
    </SectionCard>
  );
};

/** Step 2: which column of each file holds what (recognised from Eminance's headings; staff correct the rest) */
export const ImportColumnsStep: React.FC<ImportColumnsStepProps> = ({ files, onChange }) => (
  <div className="space-y-5">
    <StepIntro title="Check which column holds what">
      Columns with Eminance&apos;s own headings are matched already. Choose the column for anything marked, and leave out what the file does not have.
    </StepIntro>
    {files.filter(file => !file.problem && file.source === 'table' && file.use !== 'ignore').map(file => (
      <FileColumns key={file.index} file={file} onChange={onChange} />
    ))}
  </div>
);
