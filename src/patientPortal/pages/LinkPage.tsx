import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { birthDateFromNamibianId } from '../../../supabase/functions/_shared/patientPortalLink.ts';
import { clinicDateKey } from '../../../supabase/functions/_shared/smsReplyPlan.ts';
import { usePortal } from '../portalContext';
import { formatDateTime } from '../portalModel';
import { linkRecords, type LinkResult } from '../portalService';
import { Card, Notice, PageTitle, PrimaryButton, SecondaryButton } from '../components/PortalUi';

const lockedUntilText = (until: string): string => formatDateTime(until) ?? 'later';

/** The number is not on any patient file: only reception can fix that. */
// Inside the app (people already linked) these cards also lead back home, not only out of the app
const BackHome: React.FC<{ onHome?: () => void }> = ({ onHome }) =>
  onHome ? (
    <SecondaryButton icon="solar:home-smile-bold-duotone" onClick={onHome} className="w-full">
      Back to home
    </SecondaryButton>
  ) : null;

const NumberNotFound: React.FC<{ onSignOut: () => void; onHome?: () => void }> = ({ onSignOut, onHome }) => (
  <Card className="text-center space-y-4 py-8">
    <Icon icon="solar:phone-calling-rounded-bold-duotone" className="w-14 h-14 mx-auto text-amber-500" aria-hidden="true" />
    <h1 className="text-lg font-semibold text-gray-900">We could not find your cell number</h1>
    <p className="text-sm text-gray-600">
      This cell number is not on a patient file at a OneHealth practice. Please ask reception to add your cell number to your
      file, then sign in again.
    </p>
    <BackHome onHome={onHome} />
    <SecondaryButton icon="solar:logout-2-bold-duotone" onClick={onSignOut} className="w-full">
      Sign out
    </SecondaryButton>
  </Card>
);

const Locked: React.FC<{ until: string; askReception: boolean; onSignOut: () => void; onHome?: () => void }> = ({ until, askReception, onSignOut, onHome }) => (
  <Card className="text-center space-y-4 py-8">
    <Icon icon="solar:lock-keyhole-bold-duotone" className="w-14 h-14 mx-auto text-rose-500" aria-hidden="true" />
    <h1 className="text-lg font-semibold text-gray-900">Too many tries</h1>
    <p className="text-sm text-gray-600">
      For everyone's privacy, adding people is paused until {lockedUntilText(until)} after several details that did not match.
      {askReception && ' Please ask reception to help you.'}
    </p>
    <BackHome onHome={onHome} />
    <SecondaryButton icon="solar:logout-2-bold-duotone" onClick={onSignOut} className="w-full">
      Sign out
    </SecondaryButton>
  </Card>
);

const triesLeft = (attemptsLeft: number | undefined): string =>
  attemptsLeft === undefined ? '' : attemptsLeft === 0 ? ' This was the last try for today.' : ` ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left today.`;

/** What the person reads after a try, in plain words. */
const ResultNotice: React.FC<{ result: LinkResult }> = ({ result }) => {
  switch (result.outcome) {
    case 'linked':
      return (
        <Notice tone="success">
          <p>Added. You can now see their appointments, invoices, medicines and the results the practice shared.</p>
        </Notice>
      );
    case 'already_linked':
      return (
        <Notice tone="info">
          <p>This person is already added to your app.</p>
        </Notice>
      );
    case 'id_number_required':
      return (
        <Notice tone="warning">
          <p>
            Please also enter the ID or passport number the practice has on the file.{triesLeft(result.attemptsLeft)}
          </p>
        </Notice>
      );
    case 'mismatch':
      return (
        <Notice tone="error">
          <p>
            These details do not match a patient file with this cell number. Check the date of birth and the ID number.
            {triesLeft(result.attemptsLeft)}
          </p>
        </Notice>
      );
    case 'child_is_adult':
      return (
        <Notice tone="warning">
          <p>
            This person is 18 or older, so they cannot be added as a child. Adults add themselves: they choose "Me" and enter
            their own details.
          </p>
        </Notice>
      );
    default:
      return (
        <Notice tone="error">
          <p>{result.message ?? 'Something went wrong. Please try again.'}</p>
        </Notice>
      );
  }
};

/**
 * Add a patient file to this login after checking it is really yours (or your child's): the date of birth,
 * and the ID number when the practice has one on the file. Phones are shared, so every file is checked.
 */
const LinkPage: React.FC<{ firstTime?: boolean }> = ({ firstTime = false }) => {
  const navigate = useNavigate();
  const { status, patients, reload, signOut } = usePortal();
  const [relationship, setRelationship] = useState<'self' | 'child'>(patients.length > 0 ? 'child' : 'self');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);

  const today = clinicDateKey(new Date());
  const idBirthDate = birthDateFromNamibianId(idNumber, today);
  const idDoesNotFit = !!idBirthDate && !!dateOfBirth && idBirthDate !== dateOfBirth;

  if (status?.filesOnNumber === 0 || result?.outcome === 'no_records') {
    return <NumberNotFound onSignOut={() => void signOut()} onHome={firstTime ? undefined : () => navigate('/me')} />;
  }
  const lock = result?.outcome === 'locked' && result.until ? { until: result.until, askReception: !!result.askReception } : status?.lock;
  if (lock) return <Locked until={lock.until} askReception={lock.askReception} onSignOut={() => void signOut()} onHome={firstTime ? undefined : () => navigate('/me')} />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dateOfBirth) {
      setResult({ outcome: 'invalid', message: 'Enter the date of birth.' });
      return;
    }
    setBusy(true);
    const outcome = await linkRecords({ relationship, dateOfBirth, idNumber: idNumber.trim() });
    setBusy(false);
    setResult(outcome);
    if (outcome.outcome === 'linked') {
      setDateOfBirth('');
      setIdNumber('');
      await reload();
      if (firstTime) navigate('/me');
    }
  };

  const unlinked = status?.unlinkedOnNumber ?? 0;

  return (
    <div className="space-y-4">
      <PageTitle
        icon="solar:user-plus-bold-duotone"
        title={firstTime ? 'Confirm who you are' : 'Add a person'}
        subtitle={firstTime ? 'Once only, for each patient file' : 'Yourself or your child under 18'}
      />

      {firstTime && (
        <Notice tone="info" icon="solar:shield-user-bold-duotone">
          <p>Phones are often shared, so we check each patient file before showing it: its date of birth, and its ID number if the practice has one.</p>
        </Notice>
      )}
      {!firstTime && unlinked > 0 && (
        <Notice tone="info" icon="solar:users-group-rounded-bold-duotone">
          <p>
            This cell number is on {unlinked} more patient {unlinked === 1 ? 'file' : 'files'}. Add your child under 18 with
            the child's details. Other adults add themselves with their own details.
          </p>
        </Notice>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Who are you adding?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['self', 'child'] as const).map((option) => (
                <label
                  key={option}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm cursor-pointer ${
                    relationship === option ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="relationship"
                    value={option}
                    checked={relationship === option}
                    onChange={() => setRelationship(option)}
                    className="sr-only"
                  />
                  <Icon icon={option === 'self' ? 'solar:user-bold-duotone' : 'solar:smile-circle-bold-duotone'} className="w-5 h-5" aria-hidden="true" />
                  {option === 'self' ? 'Me' : 'My child (under 18)'}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="link-dob" className="block text-sm font-medium text-gray-700">
              {relationship === 'child' ? "Child's date of birth" : 'Your date of birth'}
            </label>
            <input
              id="link-dob"
              type="date"
              max={today}
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="link-id" className="block text-sm font-medium text-gray-700">
              ID or passport number <span className="font-normal text-gray-500">(if the practice has it)</span>
            </label>
            <input
              id="link-id"
              type="text"
              autoComplete="off"
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-3 text-base tracking-wide focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g. 85030200123"
            />
            <p className="mt-1 text-xs text-gray-500">Namibian ID numbers start with the date of birth (YYMMDD).</p>
            {idDoesNotFit && (
              <p className="mt-1 text-xs text-amber-700">This ID number does not start with the date of birth above. Please check both.</p>
            )}
          </div>

          {result && <ResultNotice result={result} />}

          <PrimaryButton type="submit" busy={busy} icon="solar:check-circle-bold-duotone" className="w-full">
            {busy ? 'Checking...' : 'Add'}
          </PrimaryButton>
        </form>
      </Card>

      <p className="text-xs text-gray-500 px-1">
        Anyone who can read the SMS messages on this phone can sign in to this app. Only add people who are happy with that.
      </p>

      {firstTime ? (
        <SecondaryButton icon="solar:logout-2-bold-duotone" onClick={() => void signOut()} className="w-full">
          Sign out
        </SecondaryButton>
      ) : (
        <SecondaryButton icon="solar:home-smile-bold-duotone" onClick={() => navigate('/me')} className="w-full">
          Back to home
        </SecondaryButton>
      )}
    </div>
  );
};

export default LinkPage;
