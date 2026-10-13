import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Icon } from '@iconify/react';
import { reconciliationStatus } from '../../../utils/remittance/parseRemittance';
import { FORMAT_LABELS, KIND_LABELS, type RemittanceDocument } from '../../../utils/remittance/types';
import { fundLabel } from '../../../utils/remittance/funds';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { inputClass, PrimaryButton } from '../receipts/ArUi';
import { EmptyState, SectionCard } from '../FinanceUI';
import { DocumentReview } from './DocumentReview';
import { readRemittanceFile, type FileState } from './importFiles';
import { loadImportedHashes, type ImportContext, type SetupState } from './remittanceService';
import { Chip, formatDateKey, nad } from './remittanceUi';

interface ImportedFile {
  key: string;
  file: File;
  sha256: string | null;
  state: FileState;
  /** Imported before (same fingerprint) */
  previous: { status: string; fileName: string } | null;
}

interface ImportSectionProps {
  practiceId: string;
  practiceName: string;
  context: ImportContext;
  setup: SetupState;
  onPosted: () => void;
}

let fileCounter = 0;

/** Drop zone and the files read in this session; a document opens its review */
export const ImportSection: React.FC<ImportSectionProps> = ({ practiceId, practiceName, context, setup, onPosted }) => {
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [open, setOpen] = useState<{ fileKey: string; part: number } | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  const update = (key: string, change: Partial<ImportedFile>) => setFiles(current => current.map(item => (item.key === key ? { ...item, ...change } : item)));

  const read = useCallback(async (key: string, file: File, password?: string) => {
    const result = await readRemittanceFile(file, password);
    let previous: ImportedFile['previous'] = null;
    if (result.sha256 && setup === 'ready') {
      try {
        previous = (await loadImportedHashes(practiceId, [result.sha256]))[result.sha256] ?? null;
      } catch {
        previous = null;
      }
    }
    update(key, { sha256: result.sha256, state: result.state, previous });
  }, [practiceId, setup]);

  const onDrop = useCallback((accepted: File[]) => {
    const added = accepted.map(file => {
      fileCounter += 1;
      return { key: `f${fileCounter}`, file, sha256: null, state: { status: 'reading' } as FileState, previous: null };
    });
    setFiles(current => [...added, ...current]);
    added.forEach(item => { void read(item.key, item.file); });
  }, [read]);

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({ onDrop, noClick: true, multiple: true });

  const opened = open ? files.find(item => item.key === open.fileKey) : null;
  const openedDoc = opened && opened.state.status === 'parsed' ? opened.state.parsed.documents[open?.part ?? 0] : null;
  if (opened && openedDoc && opened.sha256) {
    return (
      <DocumentReview
        practiceId={practiceId}
        practiceName={practiceName}
        context={context}
        setup={setup}
        fileName={opened.file.name}
        sha256={opened.sha256}
        partNumber={(open?.part ?? 0) + 1}
        doc={openedDoc}
        onBack={() => setOpen(null)}
        onPosted={() => {
          onPosted();
          update(opened.key, { previous: { status: 'posted', fileName: opened.file.name } });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${isDragActive ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300 bg-white'}`}
      >
        <input {...getInputProps()} aria-label="Remittance files" />
        <Icon icon="solar:upload-square-bold-duotone" className="mx-auto mb-3 h-12 w-12 text-cyan-500" aria-hidden="true" />
        <p className="font-medium text-gray-900">Drop remittances and fund responses here</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">
          Methealth statements (NMC, PSEMAS), Medscheme advices and monthly statements (NHP, NAMMED), NMC claim response CSVs,
          SwitchOn status reports and NHP batch acknowledgements. Several files at once is fine. Files are read on this device.
        </p>
        <div className="mt-4">
          <PrimaryButton icon="solar:folder-open-bold-duotone" onClick={openPicker}>Choose files</PrimaryButton>
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState compact icon="solar:document-text-bold-duotone" title="No files read yet" message="Each file shows its fund, payment and whether its totals add up. Open one to check the matches and post it." />
      ) : (
        <SectionCard title="Files" subtitle="Read on this device; nothing is saved until you post" icon="solar:documents-bold-duotone">
          <ul className="space-y-3">
            {files.map(item => (
              <li key={item.key} className="rounded-xl border border-gray-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all font-medium text-gray-900">{item.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.state.status === 'parsed' ? FORMAT_LABELS[item.state.parsed.format] : `${Math.max(1, Math.round(item.file.size / 1024))} KB`}
                    </p>
                  </div>
                  {item.previous && (
                    <Chip tone={item.previous.status === 'posted' ? 'green' : 'gray'} icon="solar:history-bold-duotone">
                      {item.previous.status === 'posted' ? 'Already posted' : 'Imported before'}
                    </Chip>
                  )}
                </div>
                <FileBody
                  item={item}
                  password={passwords[item.key] ?? ''}
                  onPassword={value => setPasswords(current => ({ ...current, [item.key]: value }))}
                  onUnlock={() => {
                    update(item.key, { state: { status: 'reading' } });
                    void read(item.key, item.file, passwords[item.key]);
                    setPasswords(current => ({ ...current, [item.key]: '' }));
                  }}
                  onOpen={part => setOpen({ fileKey: item.key, part })}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

const DocumentCard: React.FC<{ doc: RemittanceDocument; onOpen: () => void }> = ({ doc, onOpen }) => {
  const reconciliation = reconciliationStatus(doc);
  const difference = reconciliation.failed[0] ? reconciliation.failed[0].actualCents - reconciliation.failed[0].expectedCents : 0;
  const rejected = doc.lines.filter(line => line.status === 'rejected' || line.status === 'pended').length;
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <MedicalAidLogo name={doc.fundCode ?? doc.fundName} />
          <span className="font-semibold text-gray-900">{fundLabel(doc.fundCode, doc.fundName)}</span>
          <Chip tone="gray">{KIND_LABELS[doc.kind]}</Chip>
          {reconciliation.ok ? (
            <Chip tone="green" icon="solar:check-circle-bold-duotone">Totals match</Chip>
          ) : (
            <Chip tone="red" icon="solar:danger-triangle-bold-duotone" title={reconciliation.message ?? undefined}>
              {reconciliation.failed.length > 0 && reconciliation.failed[0].unit !== 'count' ? `Off by ${nad(Math.abs(difference))}` : 'Does not add up'}
            </Chip>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {doc.paymentDate ? `Paid ${formatDateKey(doc.paymentDate)}` : doc.documentDate ? formatDateKey(doc.documentDate) : 'No date'}
          {doc.paymentReference ? ` · ${doc.paymentReference}` : doc.statementNumber ? ` · ${doc.statementNumber}` : ''}
        </p>
        <p className="text-sm text-gray-600">
          {doc.lines.length} lines{rejected > 0 ? `, ${rejected} not paid or pended` : ''}
          {doc.kind === 'payment' || doc.kind === 'month_summary' ? ` · ${nad(doc.totalPaidCents ?? 0)}` : ''}
        </p>
      </div>
      <PrimaryButton icon="solar:eye-bold-duotone" onClick={onOpen} className="w-full sm:w-auto">
        {doc.kind === 'payment' || doc.kind === 'month_summary' ? 'Check and post' : 'Check and record'}
      </PrimaryButton>
    </div>
  );
};

const FileBody: React.FC<{
  item: ImportedFile;
  password: string;
  onPassword: (value: string) => void;
  onUnlock: () => void;
  onOpen: (part: number) => void;
}> = ({ item, password, onPassword, onUnlock, onOpen }) => {
  const { state } = item;
  if (state.status === 'reading') {
    return (
      <p className="mt-2 flex items-center gap-2 text-sm text-gray-500" role="status">
        <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading...
      </p>
    );
  }
  if (state.status === 'password') {
    const id = `pdf-password-${item.key}`;
    return (
      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); if (password) onUnlock(); }}>
        <div className="flex-1">
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
            {state.incorrect ? 'That password is not correct. Try again' : 'This PDF has a password (the fund sends it)'}
          </label>
          <input id={id} type="password" autoComplete="off" value={password} onChange={event => onPassword(event.target.value)} className={inputClass} />
        </div>
        <PrimaryButton type="submit" icon="solar:lock-unlocked-bold-duotone" disabled={!password}>Open</PrimaryButton>
      </form>
    );
  }
  if (state.status === 'unsupported' || state.status === 'error') {
    return (
      <p className={`mt-2 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-gray-600'}`} role={state.status === 'error' ? 'alert' : undefined}>
        {state.status === 'error' ? `Could not read this file: ${state.message}` : state.reason}
      </p>
    );
  }
  return (
    <div>
      {state.parsed.documents.map((doc, index) => (
        <DocumentCard key={index} doc={doc} onOpen={() => onOpen(index)} />
      ))}
      {state.parsed.warnings.map(warning => <p key={warning} className="mt-2 text-sm text-amber-700">{warning}</p>)}
    </div>
  );
};
