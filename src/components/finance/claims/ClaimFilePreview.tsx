import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { DETAIL_FIELD_NAMES, parseClaimFile, type ClaimFile } from '../../../utils/billing/claimFile';
import { downloadTextFile } from './download';

interface ClaimFilePreviewProps {
  file: ClaimFile;
  /** Shown above the file, e.g. "Draft: 3 lines still have errors". */
  note?: string;
  /** Opens the printable report of this file (patients, accounts, dates, codes, amounts) */
  onShowReport?: () => void;
  onClose: () => void;
}

/** Shows the exact claim file text and lets staff inspect any detail line field by field. */
const ClaimFilePreview: React.FC<ClaimFilePreviewProps> = ({ file, note, onShowReport, onClose }) => {
  const parsed = useMemo(() => parseClaimFile(file.content), [file.content]);
  const [inspectIndex, setInspectIndex] = useState(0);
  const inspected = parsed.details[inspectIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-file-preview-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h3 id="claim-file-preview-title" className="break-all text-lg font-semibold text-gray-900">
              {file.fileName}
            </h3>
            <p className="text-sm text-gray-500">
              {file.lineCount} claim line(s), header and trailer, format 1.6, CRLF line endings
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onShowReport && (
              <button
                type="button"
                onClick={onShowReport}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Claim report
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadTextFile(file.fileName, file.content)}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" />
              Download
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close preview">
              <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>

        {note && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-6 lg:grid-cols-2">
          <pre className="overflow-auto rounded-lg bg-gray-900 p-3 text-xs leading-5 text-gray-100" aria-label="Claim file contents">
            {file.content}
          </pre>

          <div className="flex flex-col overflow-hidden">
            <div className="mb-2 flex items-center gap-2">
              <label htmlFor="inspect-line" className="text-sm font-medium text-gray-700">
                Inspect line
              </label>
              <select
                id="inspect-line"
                value={inspectIndex}
                onChange={event => setInspectIndex(Number(event.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                disabled={parsed.details.length === 0}
              >
                {parsed.details.map((fields, index) => (
                  <option key={`${fields[1]}-${index}`} value={index}>
                    Line {fields[1]} - code {fields[12]}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-auto rounded-lg border border-gray-200">
              {inspected ? (
                <table className="w-full text-xs">
                  <tbody>
                    {inspected.map((value, index) => (
                      <tr key={index} className={value ? '' : 'text-gray-400'}>
                        <td className="w-10 border-b border-gray-100 px-2 py-1 text-right font-mono">{index + 1}</td>
                        <td className="border-b border-gray-100 px-2 py-1">{DETAIL_FIELD_NAMES[index] ?? 'Unknown'}</td>
                        <td className="border-b border-gray-100 px-2 py-1 font-mono">{value || '(empty)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-4 text-sm text-gray-500">The file has no claim lines.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimFilePreview;
