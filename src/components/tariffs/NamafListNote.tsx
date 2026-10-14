import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { plainWords } from '../../utils/plainErrors';
import { isValidDateKey } from '../../utils/billing/dates';
import { disciplineChoices, disciplineLabel, type NamafDiscipline } from '../../utils/billing/namafTariffs';
import { needsPracticeTypeChoice } from '../../utils/practiceType';
import { saveChosenDiscipline, type NamafLoad } from '../../services/namafTariffService';

interface NamafListNoteProps {
  practiceId: string;
  practiceType: string;
  /** Practice administrators (and support) choose which discipline's list the practice bills from */
  canEdit: boolean;
  namaf: NamafLoad;
  disciplines: readonly NamafDiscipline[];
  onChanged: () => void;
}

const day = (key: string | null | undefined): string => (key && isValidDateKey(key) ? format(parseISO(key), 'd MMM yyyy') : '');
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

/**
 * Admin > Tariffs > Practice tariff: which NAMAF benchmark list the practice bills from (parity E1), where it came from
 * and how long it is valid, and (administrators) another discipline's list for a practice whose type does not say it,
 * such as an anaesthetist or a private hospital. Same card look as the panel beneath it.
 */
const NamafListNote: React.FC<NamafListNoteProps> = ({ practiceId, practiceType, canEdit, namaf, disciplines, onChanged }) => {
  const [saving, setSaving] = useState(false);
  const byCode = new Map(disciplines.map(item => [item.discipline_code, item]));
  // The practice type's own discipline, as practice_types holds it (the load read it)
  const typeDiscipline = namaf.typeDiscipline;
  const labelOf = (code: string | null): string => {
    if (!code) return '';
    const known = byCode.get(code);
    return known ? disciplineLabel(known) : `discipline ${code}`;
  };
  // The practice type is chosen in Settings first (the notice above says so); the list follows from it
  if (namaf.status === 'none' && needsPracticeTypeChoice(practiceType)) return null;

  const choose = async (value: string) => {
    setSaving(true);
    try {
      await saveChosenDiscipline(practiceId, value === '' ? null : value);
      toast.success(value === '' ? "The practice type's NAMAF list is used again." : `The practice now bills from the NAMAF list for ${labelOf(value)}.`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The list could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const current = namaf.discipline ? byCode.get(namaf.discipline) ?? null : null;
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-5" aria-label="NAMAF benchmark list">
      <p className="flex items-start gap-2 text-sm text-gray-700">
        <Icon icon="solar:document-text-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#01b9d4]" aria-hidden="true" />
        <span>
          {namaf.status === 'ready' && (
            <>
              NAMAF {current?.valid_from ? `${current.valid_from.slice(0, 4)} ` : ''}benchmark list for {labelOf(namaf.discipline)}
              {current ? `: ${current.codes.toLocaleString('en-US')} codes, ${current.priced_codes.toLocaleString('en-US')} with a fixed amount, valid ${day(current.valid_from)} to ${day(current.valid_to)}` : ''}
              {namaf.chosen ? ' (chosen for this practice)' : ''}. It applies to every medical aid. A fund&apos;s own price (such as PSEMAS),
              your practice&apos;s own price and the shared list of the practice type come first. Codes without a fixed amount are offered too:
              staff type the amount when they bill them.
            </>
          )}
          {namaf.status === 'none' && 'Your practice type has no NAMAF list of its own. An administrator chooses the discipline whose list the practice bills from.'}
          {namaf.status === 'not-set-up' && 'The NAMAF benchmark list is not set up yet (proposals/2026-10-13-namaf-tariffs.sql); only the lists below are used.'}
          {namaf.status === 'error' && `${plainWords(namaf.message)} Only the lists below are used until it can be read.`}
        </span>
      </p>
      {canEdit && namaf.status !== 'not-set-up' && disciplines.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">NAMAF list</span>
          <select
            value={namaf.chosen && namaf.discipline ? namaf.discipline : ''}
            disabled={saving}
            onChange={event => void choose(event.target.value)}
            className={`max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ${FOCUS}`}
          >
            <option value="">{typeDiscipline ? `The practice type's: ${labelOf(typeDiscipline)}` : 'None (the practice type has no list)'}</option>
            {disciplineChoices(disciplines).map(item => (
              <option key={item.discipline_code} value={item.discipline_code}>
                {disciplineLabel(item)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};

export default NamafListNote;
