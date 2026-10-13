import React from 'react';
import { UNKNOWN_SCHEME, type PayerMix } from '../../../services/ledgerService';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { FUNDER_META } from '../financeTheme';
import { formatNad, formatPercent } from '../financeFormat';
import { EmptyState } from '../FinanceUI';

const MAX_SCHEMES = 5;

/**
 * Medical aid vs patient share of billed revenue. Two parts read best as a split bar with the
 * numbers beside it (not a two-slice pie); medical aid is then broken down by fund.
 */
export const PayerMixCard: React.FC<{ mix: PayerMix }> = ({ mix }) => {
  if (mix.total <= 0) {
    return <EmptyState compact icon="solar:pie-chart-2-bold-duotone" title="Nothing billed in this period" message="The payer mix appears once invoices are issued." />;
  }
  const schemes = mix.schemes.slice(0, MAX_SCHEMES);
  const others = mix.schemes.slice(MAX_SCHEMES);
  const otherAmount = others.reduce((sum, s) => sum + s.amount, 0);
  const rows = otherAmount > 0 ? [...schemes, { scheme: `${others.length} other funds`, amount: otherAmount, share: mix.medicalAid > 0 ? otherAmount / mix.medicalAid : null, invoiceCount: 0 }] : schemes;
  // The funds' logos, as on the Patients page; none for the "other funds" line or a fund that was not recorded
  const isFund = (scheme: string) => scheme !== UNKNOWN_SCHEME && schemes.some(row => row.scheme === scheme);
  const largest = Math.max(...rows.map(r => r.amount), 1);
  const width = (share: number | null) => `${Math.max(0, Math.min(100, (share ?? 0) * 100))}%`;

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={`Medical aid ${formatPercent(mix.medicalAidShare)}, patient ${formatPercent(mix.patientShare)}`}
      >
        <div className="h-full" style={{ width: width(mix.medicalAidShare), backgroundColor: FUNDER_META.medical_aid.color }} />
        <div className="h-full border-l-2 border-white" style={{ width: width(mix.patientShare), backgroundColor: FUNDER_META.patient.color }} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {(['medical_aid', 'patient'] as const).map(funder => (
          <div key={funder} className={`p-3 rounded-lg ${FUNDER_META[funder].tint}`}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: FUNDER_META[funder].color }} aria-hidden="true" />
              <span className="text-xs text-gray-600">{FUNDER_META[funder].label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatNad(funder === 'medical_aid' ? mix.medicalAid : mix.patient)}</p>
            <p className="text-xs text-gray-500">{formatPercent(funder === 'medical_aid' ? mix.medicalAidShare : mix.patientShare)} of billed</p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-gray-700 mb-2">Medical aid revenue by fund</p>
          <ul className="space-y-2">
            {rows.map(row => (
              <li key={row.scheme}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    {isFund(row.scheme) && <MedicalAidLogo name={row.scheme} />}
                    <span className="text-gray-700 truncate">{row.scheme}</span>
                  </span>
                  <span className="font-semibold text-gray-900 whitespace-nowrap">{formatNad(row.amount)} <span className="font-normal text-gray-500">({formatPercent(row.share)})</span></span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                  <div className="h-1.5 rounded-full" style={{ width: `${(row.amount / largest) * 100}%`, backgroundColor: FUNDER_META.medical_aid.color }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
