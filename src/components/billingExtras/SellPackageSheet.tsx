import React, { useEffect, useId, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../finance/receipts/ArUi';
import { loadPracticeStaff } from '../../services/invoiceContextService';
import { loadPackageTypes, sellPackage, type SoldPackage } from '../../services/billing/billingExtrasService';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { treatingPractitionerOptions, type TreatingPractitionerOption } from '../../utils/billing/invoiceRights';
import { describePackageType, validUntil, type PackageType } from '../../utils/billing/packages';

interface SellPackageSheetProps {
  practiceId: string;
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSold: (sold: SoldPackage, type: PackageType) => void;
}

/**
 * Sells a prepaid package to the patient (parity D17): the package goes on its own invoice dated today, which the
 * patient pays (Receive payment on the Billing tab); from then on a visit billing a covered code is paid from it.
 */
const SellPackageSheet: React.FC<SellPackageSheetProps> = ({ practiceId, patientId, patientName, onClose, onSold }) => {
  const id = useId();
  const [types, setTypes] = useState<PackageType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState('');
  const [practitioners, setPractitioners] = useState<TreatingPractitionerOption[]>([]);
  const [practitionerId, setPractitionerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const today = todayKey();

  useEffect(() => {
    let live = true;
    void loadPackageTypes(practiceId).then(result => {
      if (!live) return;
      if (result.status === 'ready') {
        const active = result.data.filter(type => type.isActive);
        setTypes(active);
        if (active.length === 1) setChosen(active[0].id);
      } else {
        setTypes([]);
        setLoadError(result.status === 'not_set_up' ? 'Prepaid packages are not set up in this database yet.' : result.message);
      }
    });
    loadPracticeStaff(practiceId)
      .then(staff => {
        if (live) setPractitioners(treatingPractitionerOptions(staff));
      })
      .catch(() => {
        if (live) setPractitioners([]);
      });
    return () => {
      live = false;
    };
  }, [practiceId]);

  const type = types?.find(item => item.id === chosen) ?? null;

  const sell = async () => {
    if (!type) {
      setSaveError('Choose the package.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      onSold(await sellPackage(patientId, type.id, practitionerId || null), type);
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The package could not be sold.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title="Sell a package"
      subtitle={`Sessions ${patientName} pays for now and uses at later visits. The package goes on its own invoice.`}
      icon="solar:ticket-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton busy={saving} disabled={!type} onClick={() => void sell()}>
            {saving ? 'Selling...' : type ? `Sell for ${formatNad(fromCents(type.priceCents))}` : 'Sell'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {types === null ? (
          <p className="text-sm text-gray-500" role="status">Loading the packages...</p>
        ) : loadError ? (
          <ErrorBox>{loadError}</ErrorBox>
        ) : types.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            The practice sells no packages yet. A practice administrator adds them under Admin &gt; Tariffs &gt; Contracts and co-payments.
          </p>
        ) : (
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-gray-700">Package</legend>
            <ul className="space-y-2">
              {types.map(item => (
                <li key={item.id}>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${chosen === item.id ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name={`${id}-package`}
                      value={item.id}
                      checked={chosen === item.id}
                      onChange={() => setChosen(item.id)}
                      className="mt-1 h-4 w-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      disabled={saving}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900">{item.name}</span>
                      <span className="block text-sm text-gray-600">{describePackageType(item)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {type && (
          <>
            <Field label="Practitioner (optional)" htmlFor={`${id}-practitioner`} hint="The package's invoice is recorded under them">
              <select id={`${id}-practitioner`} className={inputClass} value={practitionerId} onChange={event => setPractitionerId(event.target.value)} disabled={saving}>
                <option value="">No practitioner</option>
                {practitioners.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </Field>
            <p className="text-sm text-gray-700">
              Valid from today until {formatServiceDate(validUntil(today, type.validMonths))}. The patient pays the invoice; a medical aid is not claimed
              for it, nor for the sessions used from it.
            </p>
          </>
        )}
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};

export default SellPackageSheet;
