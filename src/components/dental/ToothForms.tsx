import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { formatNad, fromCents } from '../../utils/billing/money';
import { searchTariffs, parseTariffPrice } from '../../utils/billing/pricing';
import { MATERIAL_FACTOR_CODE, isPerVisitCode } from '../../utils/billing/tariffRules';
import type { ChartEntry, PlanItem, ToothRecord } from '../../utils/dental/chart';
import { nextPlanVisit, type PlanVisit } from '../../utils/dental/plan';
import { priceVisit } from '../../utils/dental/planPricing';
import { checkPlannedWork } from '../../utils/dental/planRules';
import { normalizeSurfaces, surfaceList, surfaceName, surfacesForTooth, type Surface } from '../../utils/dental/surfaces';
import {
  PLANNABLE_WORK,
  RECORDABLE_WORK,
  WORK_LABELS,
  canBeDefective,
  fillingCodeFor,
  planWorkForCode,
  suggestedCodes,
  type DentalWork,
  type FillingMaterial
} from '../../utils/dental/workTypes';
import type { NewChartEntry, PlanPricing } from '../../services/dental/dentalChartService';
import { MessageList, inputClass, labelClass, primaryButton, secondaryButton } from '../quotes/QuoteBits';

const chip = (selected: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    selected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
  }`;

/** Tap the surfaces of a filling; the tooth decides which surfaces it has (O or I, B or F, L or P). */
export const SurfacePicker: React.FC<{ tooth: string; value: string; onChange: (surfaces: string) => void }> = ({ tooth, value, onChange }) => {
  const chosen = surfaceList(value);
  const toggle = (surface: Surface) =>
    onChange(normalizeSurfaces(chosen.includes(surface) ? chosen.filter(item => item !== surface) : [...chosen, surface], tooth));
  return (
    <fieldset>
      <legend className={labelClass}>Surfaces</legend>
      <div className="flex flex-wrap gap-2">
        {surfacesForTooth(tooth).map(surface => (
          <button
            key={surface}
            type="button"
            aria-pressed={chosen.includes(surface)}
            aria-label={`${surface}: ${surfaceName(surface)}`}
            title={surfaceName(surface)}
            onClick={() => toggle(surface)}
            className={`h-11 w-11 rounded-lg border text-sm font-bold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              chosen.includes(surface) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {surface}
          </button>
        ))}
      </div>
    </fieldset>
  );
};

const WorkChips: React.FC<{ options: readonly DentalWork[]; value: DentalWork; onChange: (work: DentalWork) => void; legend: string }> = ({
  options,
  value,
  onChange,
  legend
}) => (
  <fieldset>
    <legend className={labelClass}>{legend}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map(work => (
        <button key={work} type="button" aria-pressed={value === work} className={chip(value === work)} onClick={() => onChange(work)}>
          {WORK_LABELS[work]}
        </button>
      ))}
    </div>
  </fieldset>
);

interface FormProps {
  tooth: string;
  /** Opened from a visit: the entry is linked to it */
  visitId: string | null;
  saving: boolean;
  onSave: (entry: NewChartEntry) => void;
  onCancel: () => void;
}

/** What an examination finds on the tooth: work already there (existing) or work that needs attention (defective). */
export const RecordWorkForm: React.FC<FormProps> = ({ tooth, visitId, saving, onSave, onCancel }) => {
  const [work, setWork] = useState<DentalWork>('filling');
  const [surfaces, setSurfaces] = useState('');
  const [defective, setDefective] = useState(false);
  const [note, setNote] = useState('');
  const canMark = canBeDefective(work);

  return (
    <form
      className="space-y-4 rounded-xl border border-gray-200 p-3"
      onSubmit={event => {
        event.preventDefault();
        onSave({
          tooth,
          work,
          status: canMark && defective ? 'defective' : 'existing',
          surfaces: work === 'filling' ? surfaces || null : null,
          visitId,
          note
        });
      }}
    >
      <WorkChips legend="What is on the tooth" options={RECORDABLE_WORK} value={work} onChange={setWork} />
      {work === 'filling' && <SurfacePicker tooth={tooth} value={surfaces} onChange={setSurfaces} />}
      {canMark && (
        <fieldset>
          <legend className={labelClass}>Its state</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!defective} className={chip(!defective)} onClick={() => setDefective(false)}>
              Existing, fine
            </button>
            <button type="button" aria-pressed={defective} className={chip(defective)} onClick={() => setDefective(true)}>
              Defective
            </button>
          </div>
        </fieldset>
      )}
      <label className="block">
        <span className={labelClass}>Note (optional)</span>
        <input className={inputClass} maxLength={300} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={saving}>
          <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Saving...' : 'Save on the chart'}
        </button>
      </div>
    </form>
  );
};

interface PlanFormProps extends FormProps {
  record: ToothRecord | undefined;
  pricing: PlanPricing;
  openVisits: readonly PlanVisit[];
  openPlan: readonly PlanItem[];
  today: string;
  defaultVisit: number;
}

const draftEntry = (tooth: string, code: string, work: DentalWork, surfaces: string | null, visit: number): ChartEntry => ({
  id: 'draft',
  tooth,
  surfaces,
  work,
  status: 'planned',
  tariffCode: code,
  planVisit: visit,
  planOrder: 1,
  quoteId: null,
  visitId: null,
  invoiceId: null,
  note: null,
  recordedBy: null,
  recordedAt: new Date().toISOString(),
  statusChangedAt: null,
  voidedAt: null,
  voidedBy: null,
  voidReason: null
});

/**
 * Plans work on the tooth: the work, the surfaces of a filling, then the code (chosen from the surfaces and the
 * material for a filling, else the usual code for the tooth from the practice's tariff list), the visit, and the
 * price as it will be quoted. Anything a fund would refuse is said before it is added.
 */
export const PlanWorkForm: React.FC<PlanFormProps> = ({
  tooth,
  visitId,
  saving,
  onSave,
  onCancel,
  record,
  pricing,
  openVisits,
  openPlan,
  today,
  defaultVisit
}) => {
  const [work, setWork] = useState<DentalWork>('filling');
  const [surfaces, setSurfaces] = useState('');
  const [material, setMaterial] = useState<FillingMaterial>('resin');
  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visit, setVisit] = useState(defaultVisit);

  const tariffByCode = useMemo(() => new Map(pricing.billable.map(tariff => [tariff.code.trim().toUpperCase(), tariff])), [pricing.billable]);
  const surfaceCount = surfaceList(surfaces).length;

  // The codes offered: for a filling the one its surfaces and material call for, otherwise the usual codes for the
  // tooth; only codes in the practice's tariff list today. Other work is searched in the whole list.
  const candidates = useMemo(() => {
    if (work === 'filling') {
      const code = fillingCodeFor(tooth, surfaceCount, material);
      return code ? [code] : [];
    }
    return suggestedCodes(work, tooth).filter(code => tariffByCode.has(code));
  }, [work, tooth, surfaceCount, material, tariffByCode]);
  const searchable = useMemo(
    () =>
      pricing.billable
        .filter(tariff => tariff.code !== MATERIAL_FACTOR_CODE && !isPerVisitCode(tariff.code))
        .map(tariff => ({ id: tariff.id, code: tariff.code, description: tariff.description ?? '' })),
    [pricing.billable]
  );
  const matches = useMemo(() => (work === 'other' && search.trim() ? searchTariffs(searchable, search).slice(0, 8) : []), [work, search, searchable]);

  // The codes to choose from with a radio button (a filling's code follows from its surfaces and material)
  const options = work === 'other' ? matches.map(match => match.code) : work === 'filling' ? [] : candidates;
  const code = work === 'other' ? picked : picked && candidates.includes(picked) ? picked : candidates[0] ?? null;
  const finalWork = code && work === 'other' ? planWorkForCode(code) : work;
  const finalSurfaces = work === 'filling' && surfaces ? surfaces : null;
  const notListed = work === 'filling' && code !== null && !tariffByCode.has(code);

  const preview = useMemo(() => {
    if (!code || notListed) return null;
    const item: PlanItem = { entry: draftEntry(tooth, code, finalWork, finalSurfaces, visit), done: false, billedBy: null, doneDate: null, quote: null };
    return priceVisit(visit, [item], pricing.context).items.get('draft') ?? null;
  }, [code, notListed, tooth, finalWork, finalSurfaces, visit, pricing.context]);

  const warnings = code
    ? checkPlannedWork({ tooth, code, work: finalWork, surfaces: finalSurfaces }, { record, openPlan, today }).map(issue => issue.message)
    : [];
  const newVisit = nextPlanVisit(openVisits);
  const canAdd = Boolean(code) && !notListed && preview !== null && !preview.problem;

  const describe = (value: string): string => {
    const tariff = tariffByCode.get(value);
    const price = tariff ? parseTariffPrice(tariff.price) : null;
    return `${value} ${tariff?.description ?? ''}${price !== null ? ` · ${formatNad(price)}` : ''}`;
  };

  return (
    <form
      className="space-y-4 rounded-xl border border-gray-200 p-3"
      onSubmit={event => {
        event.preventDefault();
        if (!canAdd || !code) return;
        onSave({ tooth, work: finalWork, status: 'planned', surfaces: finalSurfaces, tariffCode: code, planVisit: visit, visitId });
      }}
    >
      <WorkChips
        legend="Work to do"
        options={PLANNABLE_WORK}
        value={work}
        onChange={value => {
          setWork(value);
          setPicked(null);
          setSearch('');
        }}
      />

      {work === 'filling' && (
        <>
          <SurfacePicker tooth={tooth} value={surfaces} onChange={setSurfaces} />
          <fieldset>
            <legend className={labelClass}>Material</legend>
            <div className="flex flex-wrap gap-2">
              {(['resin', 'amalgam'] as const).map(option => (
                <button key={option} type="button" aria-pressed={material === option} className={chip(material === option)} onClick={() => setMaterial(option)}>
                  {option === 'resin' ? 'Resin (tooth coloured)' : 'Amalgam'}
                </button>
              ))}
            </div>
          </fieldset>
          {surfaceCount === 0 && <p className="text-sm text-gray-500">Tap the surfaces to fill: the code follows from them.</p>}
          {notListed && code && <MessageList tone="error" messages={[`Code ${code} is not in the practice's tariff list for today, so it cannot be planned.`]} />}
        </>
      )}

      {work === 'other' && (
        <div>
          <label className="block">
            <span className={labelClass}>Find the code</span>
            <span className="relative block">
              <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPicked(null);
                }}
                placeholder="Code or description"
              />
            </span>
          </label>
          {search.trim() && matches.length === 0 && <p className="mt-1 text-xs text-gray-500">No code in the tariff list matches "{search.trim()}".</p>}
        </div>
      )}

      {options.length > 0 && (
        <fieldset>
          <legend className={labelClass}>Code</legend>
          <div className="space-y-1">
            {options.map(option => (
              <label key={option} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="radio" name={`plan-code-${tooth}`} className="mt-0.5" checked={code === option} onChange={() => setPicked(option)} />
                <span className="min-w-0 text-gray-800">{describe(option)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {work !== 'filling' && work !== 'other' && candidates.length === 0 && (
        <MessageList tone="info" messages={[`None of the usual ${WORK_LABELS[work].toLowerCase()} codes is in the practice's tariff list. Choose "Other work" to search the list.`]} />
      )}

      {work === 'filling' && code && !notListed && <p className="text-sm text-gray-800">{describe(code)}</p>}

      <label className="block sm:max-w-xs">
        <span className={labelClass}>Planned visit</span>
        <select className={inputClass} value={visit} onChange={event => setVisit(Number(event.target.value))}>
          {openVisits.map(option => (
            <option key={option.visit} value={option.visit}>
              Visit {option.visit} ({option.items.length} planned)
            </option>
          ))}
          <option value={newVisit}>{openVisits.length === 0 ? `Visit ${newVisit}` : `A new visit (${newVisit})`}</option>
        </select>
      </label>

      {preview && !preview.problem && (
        <p className="text-sm text-gray-700">
          This work: <span className="font-semibold text-gray-900">{formatNad(fromCents(preview.totalCents))}</span>
          {preview.lineIds.length > 1 ? ' with its 8346 material line' : ''}
          {pricing.fund.hasMedicalAid ? `, at ${pricing.fund.fundName ?? 'the medical aid'} prices where the fund has them` : ''}.
        </p>
      )}
      {preview?.problem && <MessageList tone="error" messages={[preview.problem]} />}
      <MessageList tone="warning" title="Before you plan this" messages={warnings} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={saving || !canAdd}>
          <Icon icon="solar:clipboard-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Adding...' : 'Add to the plan'}
        </button>
      </div>
    </form>
  );
};
