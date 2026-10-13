import React, { useId, useMemo } from 'react';
import type { ValueChoices } from '../../utils/import/eminancePeople';
import type { Relationship, Sex } from '../../utils/import/importValues';
import type { FundOption, FundValue, ImportPlan } from '../../utils/import/importPlan';
import { MiniStat, Notice, SectionCard } from '../finance/FinanceUI';
import { ChoiceGroup, inputClass } from '../finance/receipts/ArUi';
import { nad, plural, type ListedRow } from './importText';
import { RowList, StepIntro } from './importUi';

type Owner = 'medical_aid' | 'patient';

interface CodeValue {
  key: string;
  raw: string;
  count: number;
}

interface ImportCheckStepProps {
  plan: ImportPlan;
  funds: readonly FundOption[];
  sexValues: readonly CodeValue[];
  relationshipValues: readonly CodeValue[];
  choices: ValueChoices;
  onChoices: (choices: ValueChoices) => void;
  /** undefined: use the suggestion again */
  onFundChoice: (key: string, providerId: string | null | undefined) => void;
  ownerOfBoth: Owner | null;
  onOwnerOfBoth: (owner: Owner) => void;
}

const NO_FUND = '__none__';

const SEX_OPTIONS: ReadonlyArray<{ value: Sex | 'skip'; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'skip', label: 'Leave these people out' }
];

const RELATIONSHIP_OPTIONS: ReadonlyArray<{ value: Relationship; label: string }> = [
  { value: 'self', label: 'Main member' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other dependant' }
];

const fundSelectValue = (value: FundValue): string => {
  const current = value.chosen !== undefined ? value.chosen : value.suggested;
  return current === undefined ? '' : current === null ? NO_FUND : current;
};

const FundRow: React.FC<{ value: FundValue; funds: readonly FundOption[]; onFundChoice: ImportCheckStepProps['onFundChoice'] }> = ({ value, funds, onFundChoice }) => {
  const id = useId();
  const selected = fundSelectValue(value);
  const open = selected === '';
  return (
    <li className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block break-words font-medium text-gray-900">&quot;{value.raw}&quot;</span>
        <span className="block text-xs text-gray-500">
          {plural(value.people, 'person', 'people')}
          {value.chosen === undefined && value.suggested !== undefined ? ' · recognised' : ''}
        </span>
      </label>
      <select
        id={id}
        className={`${inputClass} ${open ? 'border-amber-400' : ''}`}
        value={selected}
        aria-invalid={open ? true : undefined}
        onChange={event => {
          const next = event.target.value;
          onFundChoice(value.key, next === NO_FUND ? null : next);
        }}
      >
        <option value="" disabled>Choose the fund</option>
        {funds.map(fund => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
        <option value={NO_FUND}>No medical aid (private)</option>
      </select>
    </li>
  );
};

const CodeRow: React.FC<{
  value: CodeValue;
  label: string;
  selected: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder: string;
  required: boolean;
  onChange: (next: string) => void;
}> = ({ value, label, selected, options, placeholder, required, onChange }) => {
  const id = useId();
  const open = required && selected === '';
  return (
    <li className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-3">
      <label htmlFor={id}>
        <span className="block font-medium text-gray-900">{label} &quot;{value.raw}&quot;</span>
        <span className="block text-xs text-gray-500">{plural(value.count, 'person', 'people')}</span>
      </label>
      <select id={id} className={`${inputClass} ${open ? 'border-amber-400' : ''}`} value={selected} aria-invalid={open ? true : undefined} onChange={event => onChange(event.target.value)}>
        <option value="" disabled={required}>{placeholder}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </li>
  );
};

/** The plan's people, balances, recalls and claims that need a look, as rows for the lists */
function problemRows(plan: ImportPlan) {
  const skipped: ListedRow[] = [];
  const existing: ListedRow[] = [];
  const notes: ListedRow[] = [];
  for (const person of plan.people) {
    const base = { line: person.person?.line ?? null, account: person.accountNumber, label: person.label };
    if (person.decision === 'skip') skipped.push({ ...base, key: person.key, reason: person.reason });
    if (person.decision === 'existing') existing.push({ ...base, key: person.key, reason: person.reason });
    if (person.decision !== 'skip') person.warnings.forEach((warning, index) => notes.push({ ...base, key: `${person.key}:${index}`, reason: warning }));
  }
  const families = plan.families
    .filter(family => family.problem)
    .map(family => ({ key: family.accountNumber, account: family.accountNumber, label: `Account ${family.accountNumber} (${plural(family.members.length, 'person', 'people')})`, reason: family.problem }));
  const balancesSkipped = plan.balances
    .filter(balance => balance.skipReason && balance.totalCents > 0)
    .map(balance => ({ key: balance.key, label: `${balance.label}: ${nad(balance.totalCents)}`, reason: balance.skipReason }));
  const credit = plan.balances
    .filter(balance => balance.creditLeftCents > 0)
    .map(balance => ({ key: `${balance.key}:credit`, label: balance.label, reason: `${nad(balance.creditLeftCents)} in credit: refund it, or record it in OneHealth yourself` }));
  const balanceNotes = plan.balances.flatMap(balance => balance.warnings.map((warning, index) => ({ key: `${balance.key}:${index}`, label: balance.label, reason: warning })));
  const recalls = plan.recalls
    .filter(recall => recall.skipReason)
    .map(recall => ({ key: recall.key, line: recall.line, account: recall.accountNumber, label: recall.label, reason: recall.skipReason }));
  const claims = plan.unmatchedClaims.map(item => ({
    key: item.accountNumber, account: item.accountNumber, label: plural(item.lines, 'claim line', 'claim lines'),
    reason: 'No one in the patient list with this account number and date of birth'
  }));
  return { skipped, existing, notes, families, balancesSkipped, credit, balanceNotes, recalls, claims };
}

/** Step 3: what the import will do, the questions only staff can answer, and every row that needs a look */
export const ImportCheckStep: React.FC<ImportCheckStepProps> = ({
  plan, funds, sexValues, relationshipValues, choices, onChoices, onFundChoice, ownerOfBoth, onOwnerOfBoth
}) => {
  const { counts } = plan;
  const rows = useMemo(() => problemRows(plan), [plan]);
  return (
    <div className="space-y-5">
      <StepIntro title="Check what will be brought over">
        Nothing is saved yet. Answer the questions, then open the lists to see each row that is left out or needs a look.
      </StepIntro>

      {plan.openQuestions.length > 0 ? (
        <Notice tone="warning" title={`${plural(plan.openQuestions.length, 'question', 'questions')} to answer before importing`}>
          <ul className="list-disc space-y-0.5 pl-5">
            {plan.openQuestions.slice(0, 6).map(question => <li key={question}>{question}</li>)}
          </ul>
        </Notice>
      ) : (
        <Notice tone="info">Everything the import needs to know is answered.</Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon="solar:user-plus-bold-duotone" label="New patient files" value={plural(counts.newPatients, 'file', 'files')} tone="green" />
        <MiniStat icon="solar:user-check-bold-duotone" label="Already in OneHealth" value={plural(counts.existingPatients, 'file', 'files')} tone="cyan" />
        <MiniStat icon="solar:user-cross-bold-duotone" label="Left out" value={plural(counts.skippedPatients, 'row', 'rows')} tone={counts.skippedPatients ? 'red' : 'gray'} />
        <MiniStat icon="solar:users-group-rounded-bold-duotone" label="Dependants linked to a main member" value={String(counts.familyLinks)} tone="violet" />
        <MiniStat icon="solar:wallet-money-bold-duotone" label={`Opening balances on ${plural(counts.balanceAccounts, 'account', 'accounts')}`} value={nad(counts.balanceCents)} tone="amber" />
        <MiniStat icon="solar:calendar-mark-bold-duotone" label="Recalls" value={String(counts.recalls)} tone="indigo" />
        <MiniStat icon="solar:history-bold-duotone" label={`Claim lines for ${plural(counts.claimPatients, 'patient', 'patients')}`} value={String(counts.claimLines)} tone="blue" />
        <MiniStat icon="solar:medical-kit-bold-duotone" label="New files with a medical aid" value={String(counts.withMedicalAid)} tone="cyan" />
      </div>

      {plan.fundValues.length > 0 && (
        <SectionCard title="Medical aid funds" subtitle="Which OneHealth fund each Eminance medical aid value is" icon="solar:medical-kit-bold-duotone">
          <ul className="divide-y divide-gray-100">
            {plan.fundValues.map(value => <FundRow key={value.key} value={value} funds={funds} onFundChoice={onFundChoice} />)}
          </ul>
        </SectionCard>
      )}

      {sexValues.length > 0 && (
        <SectionCard title="Sex written as codes" subtitle="Say what each code means; patient files need it" icon="solar:user-check-bold-duotone" tone="amber">
          <ul className="divide-y divide-gray-100">
            {sexValues.map(value => (
              <CodeRow
                key={value.key}
                value={value}
                label="Sex"
                selected={choices.sex[value.key] ?? ''}
                options={SEX_OPTIONS}
                placeholder="Choose"
                required
                onChange={next => onChoices({ ...choices, sex: { ...choices.sex, [value.key]: next as Sex | 'skip' } })}
              />
            ))}
          </ul>
        </SectionCard>
      )}

      {relationshipValues.length > 0 && (
        <SectionCard title="Relationship written as codes" subtitle="Optional: unknown codes are brought over as dependants" icon="solar:users-group-two-rounded-bold-duotone" tone="gray">
          <ul className="divide-y divide-gray-100">
            {relationshipValues.map(value => (
              <CodeRow
                key={value.key}
                value={value}
                label="Relationship"
                selected={choices.relationship[value.key] ?? ''}
                options={RELATIONSHIP_OPTIONS}
                placeholder="Not known"
                required={false}
                onChange={next => {
                  const relationship = { ...choices.relationship };
                  if (next === '') delete relationship[value.key];
                  else relationship[value.key] = next as Relationship;
                  onChoices({ ...choices, relationship });
                }}
              />
            ))}
          </ul>
        </SectionCard>
      )}

      {plan.needsOwnerChoice && (
        <SectionCard title="Who owes the balances of members with a medical aid?" subtitle="An age analysis with both portions together does not say" icon="solar:wallet-money-bold-duotone" tone="amber">
          <div className="space-y-3">
            <ChoiceGroup<Owner>
              label="Who owes these balances"
              value={ownerOfBoth}
              onChange={onOwnerOfBoth}
              options={[
                { value: 'medical_aid', label: 'The medical aid (claims not paid yet)', icon: 'solar:medical-kit-bold-duotone' },
                { value: 'patient', label: 'The patient', icon: 'solar:user-check-bold-duotone' }
              ]}
            />
            <p className="text-xs text-gray-500">
              Accounts without a medical aid are always the patient&apos;s. To keep who owes what account by account, export the age analysis
              twice in Eminance (medical aid portion only, patient portion only) and add both files instead.
            </p>
          </div>
        </SectionCard>
      )}

      <div className="space-y-3">
        <RowList title="Not brought over" hint="Grouped by reason" rows={rows.skipped} icon="solar:user-cross-bold-duotone" tone="red" byReason />
        <RowList title="Already in OneHealth: their file is used" hint="The Eminance account number is added to it" rows={rows.existing} icon="solar:user-check-bold-duotone" tone="green" byReason />
        <RowList title="Brought over with a note" rows={rows.notes} icon="solar:info-circle-bold-duotone" tone="amber" byReason />
        <RowList title="Accounts without a clear main member" rows={rows.families} icon="solar:users-group-rounded-bold-duotone" tone="amber" byReason />
        <RowList title="Balances not brought over" rows={rows.balancesSkipped} icon="solar:wallet-money-bold-duotone" tone="red" byReason />
        <RowList title="Accounts in credit in Eminance" hint="Credit is set off against the account's own debts first; what is left is not brought over" rows={rows.credit} icon="solar:card-transfer-bold-duotone" tone="amber" />
        <RowList title="Balances with a note" rows={rows.balanceNotes} icon="solar:info-circle-bold-duotone" tone="amber" byReason />
        <RowList title="Recalls not brought over" rows={rows.recalls} icon="solar:calendar-mark-bold-duotone" tone="red" byReason />
        <RowList title="Claim lines without a patient" rows={rows.claims} icon="solar:bill-list-bold-duotone" tone="amber" byReason />
      </div>
    </div>
  );
};
