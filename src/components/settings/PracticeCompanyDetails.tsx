import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { canEditProtectedPracticeDetails } from './practiceSettingsAccess';
import {
  COMPANY_FIELDS,
  COMPANY_LABELS,
  companyChanges,
  companyProblem,
  loadCompanyDetails,
  saveCompanyDetails,
  type CompanyDetails,
  type CompanyField,
  type CompanyLoad
} from '../../services/practiceCompanyService';

const INPUT_TYPE: Partial<Record<CompanyField, string>> = { contact_email: 'email', contact_phone: 'tel' };

/**
 * Settings > System > Company details: the practice registers its own company details (owner, 13 Oct 2026), in the
 * place of the old invented block. Administrators edit them (the name, registration and VAT/tax number are theirs
 * alone in the database); everyone else reads them. Same look as the practice profile's sections.
 */
export const PracticeCompanyDetails: React.FC = () => {
  const { user } = useAuthStore();
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = user?.practice_id || contextPracticeId || null;
  const canEdit = canEditProtectedPracticeDetails(user);
  const [loaded, setLoaded] = useState<CompanyLoad | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyDetails | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void loadCompanyDetails(practiceId).then(result => {
      if (cancelled) return;
      if (result.ok) {
        setLoaded(result.value);
        setLoadError(null);
      } else {
        setLoadError(result.message);
      }
    });
    return () => { cancelled = true; };
  }, [practiceId]);

  const handleSave = async () => {
    if (!loaded || !draft || !practiceId) return;
    const problem = companyProblem(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    const changes = companyChanges(loaded.details, draft, loaded.available);
    const result = await saveCompanyDetails(practiceId, changes);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setLoaded({ ...loaded, details: { ...draft } });
    setDraft(null);
    toast.success('Company details saved');
  };

  const editing = draft !== null;

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Icon icon={SolarIcons.building} className="w-5 h-5 text-purple-600" />
          Company Details
        </h3>
        {canEdit && loaded && (!editing ? (
          <Button size="sm" variant="outline" onClick={() => setDraft({ ...loaded.details })}>
            <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={() => { void handleSave(); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        ))}
      </div>

      {!practiceId ? (
        <p className="text-sm text-gray-600">Your account is not linked to a practice.</p>
      ) : loadError ? (
        <p className="text-sm text-red-600" role="alert">{loadError}</p>
      ) : !loaded ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            Your practice's registered details. The VAT / tax number is printed on invoices and quotes.
            {!canEdit && ' Only practice administrators can change them.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMPANY_FIELDS.map(field => {
              const available = loaded.available.includes(field);
              const inputId = `company-${field}`;
              return (
                <div key={field} className="min-w-0">
                  <label htmlFor={editing && available ? inputId : undefined} className="block text-sm font-medium text-gray-700 mb-1">
                    {COMPANY_LABELS[field]}
                  </label>
                  {!available ? (
                    <p className="text-sm text-gray-500">Not set up yet</p>
                  ) : editing && draft ? (
                    <input
                      id={inputId}
                      type={INPUT_TYPE[field] ?? 'text'}
                      value={draft[field]}
                      onChange={(e) => setDraft(prev => (prev ? { ...prev, [field]: e.target.value } : prev))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 break-words">{loaded.details[field] || 'Not set'}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
        Need help with OneHealth? Email{' '}
        <a href="mailto:support@onehealthsystems.com" className="text-gray-900 hover:text-purple-600 transition-colors">
          support@onehealthsystems.com
        </a>
      </p>
    </div>
  );
};

export default PracticeCompanyDetails;
