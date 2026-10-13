import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import type { ServiceSelection } from '../../types/billing';
import { todayKey } from '../../utils/billing/dates';
import { formatNad } from '../../utils/billing/money';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { defaultDentition, quadrantName, toothName, type Dentition } from '../../utils/dental/fdi';
import { quadrantsOf } from '../../utils/dental/lineTeeth';
import { formatSurfaces } from '../../utils/dental/surfaces';
import { surfaceCountForCode } from '../../utils/dental/workTypes';
import { MessageList, inputClass } from '../quotes/QuoteBits';
import type { VisitTariff } from '../visits/visitBillingLines';
import ChartLegend from './ChartLegend';
import DentitionSwitch from './DentitionSwitch';
import Odontogram from './Odontogram';
import ToothIcon from './ToothIcon';
import { SurfacePicker } from './ToothForms';
import {
  addCodeForTeeth,
  announceOutcome,
  codesForTeeth,
  linesWithoutTooth,
  listTeeth,
  plannedCodesFor,
  sortTeeth,
  teethOnLines,
  type CodeChoice
} from './toothBilling';
import { useToothChart } from './useToothChart';

export interface TeethBillingPanelProps {
  practiceId: string | null;
  /** practices.practice_type: the chart is shown in dental practices only (isDentalPractice) */
  practiceType: string | null;
  patientId: string;
  /** The codes that may be billed on the visit date, priced for the patient (the Billing tab's list) */
  tariffs: readonly VisitTariff[];
  /** The visit's lines */
  lines: readonly ServiceSelection[];
  /** How often the practice billed each code */
  usage: Readonly<Record<string, number>>;
  hasMedicalAid: boolean;
  /** 8109 quantity: the practice's clinical staff count */
  infectionControlStaff: number;
  /** Why codes cannot be added yet (the patient's fund prices are loading or unclear) */
  disabledReason: string | null;
  onApply: (lines: ServiceSelection[]) => void;
  /** True once invoice lines keep tooth surfaces (the line-teeth update): a filling's surfaces are marked here */
  canRecordSurfaces?: boolean;
}

/** Codes shown per group before "Show all": what matters now, the rest one tap away. */
const FIRST_CODES = 8;

/**
 * The visit's Billing tab in a dental practice: the patient's tooth chart, where staff tap the teeth they treated and
 * then the work for them. A code that needs a tooth gets one line per tooth; a code billed per quadrant one line per
 * quadrant; codes planned on those teeth come first, then the practice's most used codes. With one tooth chosen, the
 * surfaces of a filling are tapped first and the code for that many surfaces comes to the top (parity D5). Other
 * practices see nothing here and keep the service list.
 */
const TeethBillingPanel: React.FC<TeethBillingPanelProps> = props => {
  const { practiceId, practiceType, patientId, tariffs, lines, usage, hasMedicalAid, infectionControlStaff, disabledReason, onApply } = props;
  const canRecordSurfaces = props.canRecordSurfaces === true;
  const isDental = isDentalPractice(practiceType);
  const headingId = useId();
  const chart = useToothChart(practiceId, patientId, isDental);
  const [dentition, setDentition] = useState<Dentition | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  // Surfaces belong to the one chosen tooth: marked again for each tooth
  const [marked, setMarked] = useState<{ tooth: string; surfaces: string } | null>(null);
  const onVisit = useMemo(() => teethOnLines(lines), [lines]);
  const teeth = useMemo(() => sortTeeth(chosen), [chosen]);
  const surfaces = canRecordSurfaces && teeth.length === 1 && marked?.tooth === teeth[0] ? marked.surfaces : '';
  const planned = useMemo(() => plannedCodesFor(chart.model.planItems, chosen), [chart.model.planItems, chosen]);
  const codes = useMemo(
    () => codesForTeeth(tariffs, { usage, query, planned, teeth, lines, surfaces }),
    [tariffs, usage, query, planned, teeth, lines, surfaces]
  );
  const offersFillings = useMemo(() => codes.forTeeth.some(choice => surfaceCountForCode(choice.code) !== null), [codes.forTeeth]);
  const noTooth = useMemo(() => linesWithoutTooth(lines, tariffs), [lines, tariffs]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Escape in a filled search box clears it. The visit screen closes on Escape (on the document, before this box
  // hears it), so the key is caught on the window first: clearing a search must never close the visit.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const search = searchRef.current;
      if (event.key !== 'Escape' || !search || document.activeElement !== search || search.value === '') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setQuery('');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  if (!isDental) return null;

  const shown = dentition ?? defaultDentition(chart.dateOfBirth, todayKey(), [...chart.model.recordedTeeth, ...onVisit.keys()]);
  const toggle = (tooth: string) =>
    setChosen(current => {
      const next = new Set(current);
      if (next.has(tooth)) next.delete(tooth);
      else next.add(tooth);
      return next;
    });

  const add = (choice: CodeChoice) => {
    if (disabledReason) {
      toast.error(disabledReason, { id: 'fund-prices' });
      return;
    }
    const outcome = addCodeForTeeth(
      lines,
      choice.tariff,
      teeth,
      1,
      { tariffs, hasMedicalAid, autoInfectionControl: true, infectionControlStaff },
      { surfaces }
    );
    announceOutcome(outcome, choice.code);
    if (outcome.status === 'added') onApply(outcome.lines);
  };
  const groupLimit = showAll || query.trim() ? null : FIRST_CODES;
  const codeCount = codes.forTeeth.length + codes.forQuadrants.length + codes.withoutTooth.length;

  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
            <ToothIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 id={headingId} className="text-base font-semibold text-gray-900">
              Teeth
            </h4>
            <p className="text-sm text-gray-500">Tap the teeth treated, then choose the work: one line per tooth.</p>
          </div>
        </div>
        <DentitionSwitch value={shown} onChange={setDentition} />
      </div>

      {noTooth.length > 0 && (
        <div className="mt-3">
          <MessageList
            tone="warning"
            messages={[
              `${noTooth.map(line => line.code).join(', ')} ${noTooth.length === 1 ? 'needs' : 'need'} a tooth and ${noTooth.length === 1 ? 'has' : 'have'} none on this visit. A fund refuses such a line: take it off, then add it again for its tooth on the chart.`
            ]}
          />
        </div>
      )}

      {chart.load.status === 'error' && (
        <p className="mt-3 text-xs text-amber-800">The patient's chart could not be read ({chart.load.message}). You can still choose teeth and bill them.</p>
      )}

      <div className="mt-4">
        <Odontogram dentition={shown} model={chart.model} mode="select" selected={chosen} onToothClick={toggle} onVisit={onVisit} />
      </div>
      <div className="mt-3">
        <ChartLegend billing />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        {teeth.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Icon icon="solar:cursor-bold-duotone" className="h-5 w-5 flex-none text-gray-400" aria-hidden="true" />
            Choose one or more teeth to see the codes for them.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{teeth.length === 1 ? 'Tooth' : `${teeth.length} teeth`}</span>
              {teeth.map(tooth => (
                <button
                  key={tooth}
                  type="button"
                  onClick={() => toggle(tooth)}
                  aria-label={`Tooth ${tooth}, ${toothName(tooth)}: take it off`}
                  title={toothName(tooth)}
                  className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-1 pl-2.5 pr-1.5 text-sm font-semibold tabular-nums text-cyan-800 ring-1 ring-cyan-200 transition-colors hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none"
                >
                  {tooth}
                  <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setChosen(new Set())}
                className="rounded-md px-1.5 py-1 text-sm font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                Clear
              </button>
            </div>

            {canRecordSurfaces && teeth.length === 1 && offersFillings && (
              <div>
                <SurfacePicker tooth={teeth[0]} value={surfaces} onChange={next => setMarked({ tooth: teeth[0], surfaces: next })} />
                <p className="mt-1 text-xs text-gray-500">
                  {surfaces
                    ? `Surfaces ${formatSurfaces(surfaces)}: the filling code for ${surfaces.length} surface${surfaces.length === 1 ? '' : 's'} is marked "Fits".`
                    : 'For a filling, tap its surfaces first: the code for that many surfaces comes to the top.'}
                </p>
              </div>
            )}

            <label className="relative block">
              <span className="sr-only">Find a code for these teeth</span>
              <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Find a code or description"
                className={`${inputClass} pl-9`}
              />
            </label>

            {disabledReason && <MessageList tone="warning" messages={[disabledReason]} />}

            <CodeGroup
              title={teeth.length === 1 ? `For tooth ${teeth[0]}` : `For each of teeth ${listTeeth(teeth)}`}
              note="One line per tooth"
              choices={codes.forTeeth}
              teeth={teeth}
              limit={groupLimit}
              disabled={Boolean(disabledReason)}
              onAdd={add}
            />
            <CodeGroup
              title={`Per quadrant: ${listTeeth(quadrantsOf(teeth).map(quadrant => quadrantName(quadrant).toLowerCase()))}`}
              note="One line per quadrant"
              choices={codes.forQuadrants}
              teeth={teeth}
              limit={groupLimit}
              disabled={Boolean(disabledReason)}
              onAdd={add}
            />
            <CodeGroup
              title="Without a tooth"
              note="Added once for the visit"
              choices={codes.withoutTooth}
              teeth={teeth}
              limit={groupLimit}
              disabled={Boolean(disabledReason)}
              onAdd={add}
            />
            {!showAll && !query.trim() && [codes.forTeeth, codes.forQuadrants, codes.withoutTooth].some(group => group.length > FIRST_CODES) && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-sm font-medium text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                Show all {codeCount} codes
              </button>
            )}
            {codeCount === 0 && (
              <p className="text-sm text-gray-500">
                {query.trim()
                  ? `No code in the price list matches "${query.trim()}".`
                  : "The practice's price list has no codes for this visit date yet. An administrator can import the practice's schedule under Admin, Tariffs."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const CodeGroup: React.FC<{
  title: string;
  note: string;
  choices: readonly CodeChoice[];
  teeth: readonly string[];
  /** How many to show; null for all */
  limit: number | null;
  disabled: boolean;
  onAdd: (choice: CodeChoice) => void;
}> = ({ title, note, choices, teeth, limit, disabled, onAdd }) => {
  if (choices.length === 0) return null;
  const shown = limit === null ? choices : choices.slice(0, limit);
  return (
    <section>
      <h5 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
        <span className="font-normal normal-case tracking-normal text-gray-400">{note}</span>
      </h5>
      <ul className="space-y-1.5">
        {shown.map(choice => (
          <li key={choice.tariff.id}>
            <CodeRow choice={choice} teeth={teeth} disabled={disabled} onAdd={() => onAdd(choice)} />
          </li>
        ))}
      </ul>
    </section>
  );
};

const CodeRow: React.FC<{ choice: CodeChoice; teeth: readonly string[]; disabled: boolean; onAdd: () => void }> = ({ choice, teeth, disabled, onAdd }) => {
  const quadrants = choice.perQuadrant ? quadrantsOf(teeth) : [];
  const perTooth = choice.needsTooth && !choice.perQuadrant && teeth.length > 1;
  const lineCount = choice.perQuadrant ? quadrants.length : perTooth ? teeth.length : 1;
  const forTeeth = choice.perQuadrant
    ? ` for the ${listTeeth(quadrants.map(quadrant => quadrantName(quadrant).toLowerCase()))} quadrant${quadrants.length === 1 ? '' : 's'}`
    : choice.needsTooth
      ? ` for ${teeth.length === 1 ? 'tooth' : 'teeth'} ${listTeeth(teeth)}`
      : '';
  const each = choice.perQuadrant ? ' per quadrant' : perTooth ? ' per tooth' : '';
  const surfaceCount = surfaceCountForCode(choice.code);
  const notes = [
    choice.unitPrice === null ? 'price to check' : `${formatNad(choice.unitPrice)}${each}`,
    choice.surfaceFit === 'fits' ? 'fits the surfaces marked' : '',
    choice.surfaceFit === 'other' && surfaceCount !== null ? `for ${surfaceCount === 4 ? '4 or more surfaces' : `${surfaceCount} surface${surfaceCount === 1 ? '' : 's'}`}, not the surfaces marked` : '',
    choice.plannedFor.length > 0 ? `planned for ${listTeeth(choice.plannedFor)}` : '',
    choice.alreadyOn.length > 0 ? `already on this visit for ${listTeeth(choice.alreadyOn)}` : ''
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      aria-label={`Add ${choice.code} ${choice.description}${forTeeth}: ${notes.join(', ')}`}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-gray-200 transition-colors hover:bg-cyan-50/60 hover:ring-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
    >
      <span className="w-11 flex-none text-sm font-semibold tabular-nums text-gray-900">{choice.code}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug text-gray-800 sm:truncate">{choice.description || 'No description'}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span className={`tabular-nums ${choice.unitPrice === null ? 'text-amber-700' : ''}`}>
            {choice.unitPrice === null ? 'Price to check' : `${formatNad(choice.unitPrice)}${each}`}
          </span>
          {choice.surfaceFit === 'fits' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800 ring-1 ring-emerald-200">
              <Icon icon="solar:check-circle-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
              Fits
            </span>
          )}
          {choice.surfaceFit === 'other' && surfaceCount !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-1.5 py-0.5 font-medium text-gray-600 ring-1 ring-gray-200">
              For {surfaceCount === 4 ? '4 or more surfaces' : `${surfaceCount} surface${surfaceCount === 1 ? '' : 's'}`}
            </span>
          )}
          {choice.plannedFor.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">
              <Icon icon="solar:clipboard-list-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
              Planned for {listTeeth(choice.plannedFor)}
            </span>
          )}
          {choice.alreadyOn.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-1.5 py-0.5 font-medium text-teal-800 ring-1 ring-teal-200">
              <Icon icon="solar:check-circle-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
              On this visit for {listTeeth(choice.alreadyOn)}
            </span>
          )}
          {choice.uses > 0 && (
            <span>
              Used {choice.uses} time{choice.uses === 1 ? '' : 's'}
            </span>
          )}
        </span>
      </span>
      <span className="inline-flex flex-none items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-cyan-700 motion-reduce:transition-none" aria-hidden="true">
        <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" />
        Add
        {lineCount > 1 && <span className="hidden sm:inline">&nbsp;{lineCount} lines</span>}
      </span>
    </button>
  );
};

export default TeethBillingPanel;
