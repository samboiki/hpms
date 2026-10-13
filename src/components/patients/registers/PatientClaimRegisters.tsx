import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { LetterComposer } from '../../letters/LetterComposer';
import { usePatientClaimRegisters } from '../../../hooks/usePatientClaimRegisters';
import { loadPatientFundKey } from '../../../services/fundPricingService';
import { openRecord } from '../../../services/recordFiles';
import { removePatientAuthorisation, removePatientReferral } from '../../../services/claimRegistersService';
import { formatServiceDate, todayKey } from '../../../utils/billing/dates';
import { describeReferralValidity, describeReferrer, referralState, type PatientReferral, type ReferralState } from '../../../utils/billing/referrals';
import { authorisationState, describeAuthorisation, type AuthorisationState, type PatientAuthorisation } from '../../../utils/billing/authorisations';
import ReferralSheet from './ReferralSheet';
import AuthorisationSheet from './AuthorisationSheet';

interface PatientClaimRegistersProps {
  practiceId: string;
  patientId: string;
}

const PRIMARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
const LINK = 'font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded disabled:opacity-50';

const REFERRAL_CHIP: Record<ReferralState, { className: string; icon: string }> = {
  valid: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'solar:check-circle-bold-duotone' },
  not_yet: { className: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'solar:clock-circle-bold-duotone' },
  expired: { className: 'bg-red-50 text-red-700 border-red-200', icon: 'solar:close-circle-bold-duotone' },
  removed: { className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:trash-bin-trash-bold-duotone' }
};

const AUTHORISATION_CHIP: Record<AuthorisationState, { className: string; icon: string; label: (authorisation: PatientAuthorisation) => string }> = {
  active: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'solar:check-circle-bold-duotone', label: a => `Active until ${formatServiceDate(a.validTo)}` },
  not_yet: { className: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'solar:clock-circle-bold-duotone', label: a => `Starts ${formatServiceDate(a.validFrom)}` },
  expired: { className: 'bg-red-50 text-red-700 border-red-200', icon: 'solar:close-circle-bold-duotone', label: a => `Ended ${formatServiceDate(a.validTo)}` },
  used_up: { className: 'bg-amber-50 text-amber-800 border-amber-200', icon: 'solar:danger-triangle-bold-duotone', label: () => 'Used up' },
  removed: { className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:trash-bin-trash-bold-duotone', label: () => 'Removed' }
};

const Chip: React.FC<{ className: string; icon: string; children: React.ReactNode }> = ({ className, icon, children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${className}`}>
    <Icon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
    {children}
  </span>
);

const SectionHeader: React.FC<{ icon: string; title: string; subtitle: string; children?: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-50 text-cyan-700">
        <Icon icon={icon} className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>
);

/**
 * The patient's referrals and fund authorisations on the Billing tab of the patient file (parity C10, D15, F18): what
 * reception records once, so that claims carry the referring practitioner and the authorisation number without typing
 * them on every visit. Outgoing referral letters are written with the practice's letters (LetterComposer).
 */
const PatientClaimRegisters: React.FC<PatientClaimRegistersProps> = ({ practiceId, patientId }) => {
  const registers = usePatientClaimRegisters(patientId);
  const [today] = useState(() => todayKey());
  // The patient's fund (its claim code): a new authorisation starts with it
  const [patientFund, setPatientFund] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadPatientFundKey({ patientId }).then(result => {
      if (live) setPatientFund(result.fund?.reference ?? null);
    });
    return () => {
      live = false;
    };
  }, [patientId]);
  const [referralSheet, setReferralSheet] = useState<{ referral: PatientReferral | null } | null>(null);
  const [authorisationSheet, setAuthorisationSheet] = useState<{ authorisation: PatientAuthorisation | null } | null>(null);
  const [writeLetter, setWriteLetter] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (registers.status === 'not_set_up') {
    return (
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader icon="solar:document-medicine-bold-duotone" title="Referrals and authorisations" subtitle="Referral letters and the medical aid's authorisation numbers for this patient." />
        <p className="px-4 py-4 text-sm text-gray-600">Referrals and authorisations are not set up in this database yet, so they cannot be recorded here.</p>
      </section>
    );
  }

  const removedCount = registers.referrals.filter(item => item.removedAt).length + registers.authorisations.filter(item => item.removedAt).length;
  const referrals = registers.referrals.filter(item => showRemoved || !item.removedAt);
  const authorisations = registers.authorisations.filter(item => showRemoved || !item.removedAt);
  const loading = registers.status === 'loading';

  const run = async (itemId: string, work: () => Promise<void>, done: string) => {
    setBusyId(itemId);
    setError(null);
    try {
      await work();
      setNotice(done);
      registers.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const removeReferral = (referral: PatientReferral) => {
    if (!window.confirm(`Remove the referral from ${referral.referringName}? It stays on the file as removed; claims no longer name it.`)) return;
    void run(referral.id, () => removePatientReferral(referral.id), 'The referral was removed.');
  };

  const removeAuthorisation = (authorisation: PatientAuthorisation) => {
    if (!window.confirm(`Remove authorisation ${authorisation.number}? Lines that already carry it keep it; new lines no longer get it.`)) return;
    void run(authorisation.id, () => removePatientAuthorisation(authorisation.id), `Authorisation ${authorisation.number} was removed.`);
  };

  return (
    <div className="space-y-6">
      {(notice || error || registers.message) && (
        <div
          className={`flex items-start justify-between gap-3 p-3 rounded-lg text-sm ${error || registers.message ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`}
          role={error || registers.message ? 'alert' : 'status'}
        >
          <span className="flex items-start gap-2">
            <Icon icon={error || registers.message ? 'solar:danger-triangle-bold-duotone' : 'solar:check-circle-bold-duotone'} className="mt-0.5 w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {error ?? registers.message ?? notice}
          </span>
          <button type="button" onClick={() => { setNotice(null); setError(null); }} className="font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Referrals from other practitioners */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader icon="solar:document-medicine-bold-duotone" title="Referrals" subtitle="Letters from practitioners who referred this patient. A visit's claim names the referring practitioner from here.">
          <button type="button" className={PRIMARY} onClick={() => setReferralSheet({ referral: null })} disabled={loading}>
            <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            Add referral
          </button>
          <button type="button" className={SECONDARY} onClick={() => setWriteLetter(true)} title="Refer this patient to another practitioner">
            <Icon icon="solar:letter-opened-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            Write a referral letter
          </button>
        </SectionHeader>
        <div className="p-4">
          {loading && registers.referrals.length === 0 ? (
            <div className="space-y-2" role="status" aria-label="Loading referrals">
              {[0, 1].map(index => <div key={index} className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" />)}
            </div>
          ) : referrals.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No referrals on file. Add one when the patient brings a referral letter.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {referrals.map(referral => {
                const state = referralState(referral, today);
                const chip = REFERRAL_CHIP[state];
                return (
                  <li key={referral.id} className={`py-3 ${referral.removedAt ? 'text-gray-400' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 break-words">{describeReferrer(referral)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Letter {formatServiceDate(referral.referralDate)}
                          {referral.referralNumber ? ` · referral ${referral.referralNumber}` : ''}
                        </p>
                        {referral.reason && <p className="mt-1 text-sm text-gray-700 break-words">{referral.reason}</p>}
                      </div>
                      <Chip className={chip.className} icon={chip.icon}>{describeReferralValidity(referral, today)}</Chip>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {referral.letterPath && (
                        <button type="button" className={LINK} onClick={() => void openRecord(referral.letterPath as string).catch(failure => setError(failure instanceof Error ? failure.message : 'The letter could not be opened.'))}>
                          Open the letter
                        </button>
                      )}
                      {!referral.removedAt && (
                        <>
                          <button type="button" className={LINK} onClick={() => setReferralSheet({ referral })} disabled={busyId === referral.id}>Change</button>
                          <button type="button" className={LINK} onClick={() => removeReferral(referral)} disabled={busyId === referral.id}>
                            {busyId === referral.id ? 'Removing...' : 'Remove'}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* The medical aid's authorisations */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader icon="solar:shield-check-bold-duotone" title="Authorisations" subtitle="Numbers the medical aid gave for this patient. Lines billed in the window for the codes listed carry the number on the claim.">
          <button type="button" className={PRIMARY} onClick={() => setAuthorisationSheet({ authorisation: null })} disabled={loading}>
            <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            Add authorisation
          </button>
        </SectionHeader>
        <div className="p-4">
          {loading && registers.authorisations.length === 0 ? (
            <div className="space-y-2" role="status" aria-label="Loading authorisations">
              {[0, 1].map(index => <div key={index} className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" />)}
            </div>
          ) : authorisations.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No authorisations on file. Add one when the medical aid approves a treatment.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {authorisations.map(authorisation => {
                const state = authorisationState(authorisation, today, registers.usage);
                const chip = AUTHORISATION_CHIP[state];
                return (
                  <li key={authorisation.id} className={`py-3 ${authorisation.removedAt ? 'text-gray-400' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                          <MedicalAidLogo name={authorisation.fundReference} />
                          <span className="break-all">{authorisation.number}</span>
                          <span className="text-xs font-normal text-gray-500">{authorisation.fundReference}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{describeAuthorisation(authorisation, registers.usage)}</p>
                        {authorisation.note && <p className="mt-1 text-sm text-gray-700 break-words">{authorisation.note}</p>}
                        {authorisation.quoteId && <p className="mt-1 text-xs text-gray-500">Recorded from a quote&apos;s pre-authorisation</p>}
                      </div>
                      <Chip className={chip.className} icon={chip.icon}>{chip.label(authorisation)}</Chip>
                    </div>
                    {!authorisation.removedAt && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <button type="button" className={LINK} onClick={() => setAuthorisationSheet({ authorisation })} disabled={busyId === authorisation.id}>Change</button>
                        <button type="button" className={LINK} onClick={() => removeAuthorisation(authorisation)} disabled={busyId === authorisation.id}>
                          {busyId === authorisation.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Referrals and authorisations removed by mistake stay on the file, out of the way */}
      {removedCount > 0 && (
        <button type="button" className={`text-sm ${LINK}`} onClick={() => setShowRemoved(value => !value)} aria-pressed={showRemoved}>
          {showRemoved ? 'Hide removed referrals and authorisations' : `Show removed referrals and authorisations (${removedCount})`}
        </button>
      )}

      {referralSheet && (
        <ReferralSheet
          practiceId={practiceId}
          patientId={patientId}
          referral={referralSheet.referral}
          onClose={() => setReferralSheet(null)}
          onSaved={() => {
            setReferralSheet(null);
            setNotice(referralSheet.referral ? 'The referral was changed.' : 'The referral was added.');
            registers.reload();
          }}
        />
      )}
      {authorisationSheet && (
        <AuthorisationSheet
          patientId={patientId}
          authorisation={authorisationSheet.authorisation}
          patientFund={patientFund}
          onClose={() => setAuthorisationSheet(null)}
          onSaved={result => {
            setAuthorisationSheet(null);
            setNotice(
              result.applied > 0
                ? `Saved. ${result.applied} ${result.applied === 1 ? 'line' : 'lines'} already billed in its window now ${result.applied === 1 ? 'carries' : 'carry'} the number.`
                : 'Saved. Lines billed in its window carry the number.'
            );
            registers.reload();
          }}
        />
      )}
      {/* Referring the patient elsewhere: the practice's letters (and their templates) write the letter */}
      {writeLetter && (
        <LetterComposer open practiceId={practiceId} patientId={patientId} visitId={null} initialKind="referral" onClose={() => setWriteLetter(false)} />
      )}
    </div>
  );
};

export default PatientClaimRegisters;
