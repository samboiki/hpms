import React from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { claimBatchesLink } from '../billing/invoiceLinks';
import { MedicalAidLogo } from '../ui/MedicalAidLogo';
import { Chip } from '../stock/stockParts';
import { CARD, LINK, QUIET } from '../stock/stockUi';
import { deadlineFromService } from '../../utils/billing/fundRules';
import { formatServiceDate } from '../../utils/billing/dates';
import { describeMembership } from '../../utils/billing/fundMaster';
import { SILENT_DAYS_GENERAL, silentDaysFor, type SilentFundDays } from '../finance/claims/batchFollowUp';
import type { FundEntry } from '../../services/fundMasterService';

interface FundCardProps {
  fund: FundEntry;
  /** The practice's own waits before "Funds that have not answered" (they win over the fund's terms); null: none set */
  practiceWaits: SilentFundDays | null;
  /** OneHealth support changes the fund's details and rules */
  canEdit: boolean;
  onEdit: () => void;
  /** The practice's note on the fund (PracticeFundNote) */
  children?: React.ReactNode;
}

const Row: React.FC<{ icon: string; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <>
    <dt className="flex items-start gap-2 text-gray-500">
      <Icon icon={icon} className="mt-0.5 h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
      {label}
    </dt>
    <dd className="min-w-0 break-words text-gray-900">{children}</dd>
  </>
);

/**
 * One fund as the claim checks use it: deadline (and whether it is confirmed), where claims go, what its membership
 * numbers look like, the dependant code, how long it takes to answer, and when OneHealth support last changed it.
 */
export const FundCard: React.FC<FundCardProps> = ({ fund, practiceWaits, canEdit, onEdit, children }) => {
  const { rule } = fund;
  const membership = describeMembership(rule);
  const terms = rule.paymentTermsDays;
  const ownWait = practiceWaits && fund.code ? silentDaysFor(fund.code, practiceWaits) : null;
  return (
    <article className={`${CARD} flex flex-col p-4 sm:p-5`} aria-labelledby={`fund-${fund.providerId}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* A new logo link shows at once: the logo is drawn again when its link changes */}
          <MedicalAidLogo key={fund.logoUrl ?? 'none'} name={fund.name} size="md" />
          <div className="min-w-0">
            <h2 id={`fund-${fund.providerId}`} className="break-words text-base font-semibold text-gray-900">{fund.name}</h2>
            <p className="text-xs text-gray-500">{fund.code ? `Claim code ${fund.code}` : 'No claim code: its claims cannot be checked'}</p>
          </div>
        </div>
        {canEdit && (
          <button type="button" onClick={onEdit} className={QUIET} aria-label={`Change ${fund.name}`}>
            <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Change
          </button>
        )}
      </header>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <Row icon="solar:calendar-mark-bold-duotone" label="Claim deadline">
          {rule.configured ? deadlineFromService(rule) : 'Not known (120 days assumed)'}
          <div className="mt-1">
            {rule.confirmed ? (
              <Chip tone="green" icon="solar:check-circle-bold-duotone">Confirmed: later lines are not sent</Chip>
            ) : (
              <Chip tone="amber" icon="solar:danger-triangle-bold-duotone">Not confirmed: later lines are only flagged</Chip>
            )}
          </div>
        </Row>
        <Row icon="solar:letter-bold-duotone" label="Claims email">
          {fund.claimsEmail ? fund.claimsEmail : <span className="text-red-700">Not set: claims cannot be emailed</span>}
        </Row>
        {rule.claimsPortalUrl && (
          <Row icon="solar:global-bold-duotone" label="Claims portal">
            <a href={rule.claimsPortalUrl} target="_blank" rel="noopener noreferrer" className={`${LINK} inline-flex items-center gap-1`}>
              Open the portal
              <Icon icon="solar:square-arrow-right-up-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            </a>
          </Row>
        )}
        <Row icon="solar:card-bold-duotone" label="Membership numbers">
          {membership ? `Digits only, ${membership}` : 'Not set: not checked'}
          {rule.membershipHint && <p className="mt-0.5 text-xs text-gray-500">{rule.membershipHint}</p>}
        </Row>
        <Row icon="solar:users-group-rounded-bold-duotone" label="Dependants">
          {rule.dependantCodeRequired ? 'Claimed with the dependant code from the card' : 'No dependant code needed'}
        </Row>
        <Row icon="solar:hourglass-bold-duotone" label="Payment terms">
          {terms !== null ? `Usually answers within ${terms} days` : `Not set (${SILENT_DAYS_GENERAL} days assumed)`}
          {ownWait !== null && (
            <p className="mt-0.5 text-xs text-gray-500">
              Your practice warns after {ownWait} days (its own setting in <Link to={claimBatchesLink()} className={LINK}>Finance &gt; Batches</Link> wins).
            </p>
          )}
        </Row>
        <Row icon="solar:history-bold-duotone" label="Last changed">
          {fund.changedAt ? `${formatServiceDate(new Date(fund.changedAt))} by OneHealth support` : "The app's usual values (not changed yet)"}
        </Row>
      </dl>

      {children && <div className="mt-4 border-t border-gray-100 pt-4">{children}</div>}
    </article>
  );
};
