import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import type { ServiceSelection } from '../../types/billing';
import { todayKey } from '../../utils/billing/dates';
import { defaultDentition, quadrantName, type Dentition } from '../../utils/dental/fdi';
import { quadrantsOf } from '../../utils/dental/lineTeeth';
import { isPerQuadrantCode, surfaceCodeProblem, surfaceCountForCode } from '../../utils/dental/workTypes';
import PickerDialog from '../billing/PickerDialog';
import { MessageList, primaryButton, secondaryButton } from '../quotes/QuoteBits';
import type { VisitTariff } from '../visits/visitBillingLines';
import DentitionSwitch from './DentitionSwitch';
import Odontogram from './Odontogram';
import { SurfacePicker } from './ToothForms';
import { addCodeForTeeth, announceOutcome, listTeeth, sortTeeth, surfacesForCode, teethOnLines } from './toothBilling';
import { useToothChart } from './useToothChart';

export interface ToothPickerDialogProps {
  open: boolean;
  /** The code picked in the service list; it needs a tooth */
  tariff: VisitTariff | null;
  /** Units on each tooth's line (from the quantity step) */
  quantity: number;
  practiceId: string | null;
  patientId: string;
  /** The visit's lines and the codes they are priced from (as on the Billing tab) */
  lines: readonly ServiceSelection[];
  tariffs: readonly VisitTariff[];
  hasMedicalAid: boolean;
  /** Dental practices: 8109 once per visit and the 8346 material line after a restoration */
  autoInfectionControl: boolean;
  infectionControlStaff: number;
  /** Why lines cannot be added yet (the patient's fund prices are loading or unclear) */
  disabledReason: string | null;
  onApply: (lines: ServiceSelection[]) => void;
  onCancel: () => void;
  /** True once invoice lines keep tooth surfaces (the line-teeth update): a filling's surfaces are marked here */
  canRecordSurfaces?: boolean;
}

/**
 * The teeth for a code that needs a tooth, picked from the service list: the patient's chart with milk teeth when
 * needed; one or more teeth, then one line per tooth (one per quadrant for a code billed per quadrant). For a filling
 * on one tooth its surfaces are marked too, and must be as many as the code is for (parity D5). Nothing is added
 * without a tooth.
 */
const ToothPickerDialog: React.FC<ToothPickerDialogProps> = props => {
  const { open, tariff, quantity, practiceId, patientId, lines, tariffs, hasMedicalAid, autoInfectionControl, infectionControlStaff, disabledReason, onApply, onCancel } = props;
  const chart = useToothChart(practiceId, patientId, open);
  const [dentition, setDentition] = useState<Dentition | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [marked, setMarked] = useState<{ tooth: string; surfaces: string } | null>(null);

  // Each code starts with no tooth chosen
  useEffect(() => {
    if (!open) {
      setChosen(new Set());
      setMarked(null);
    }
  }, [open]);

  if (!open || !tariff) return null;

  const onVisit = teethOnLines(lines);
  const shown = dentition ?? defaultDentition(chart.dateOfBirth, todayKey(), [...chart.model.recordedTeeth, ...onVisit.keys()]);
  const teeth = sortTeeth(chosen);
  // Surfaces of a filling on one tooth: marked again for each tooth
  const surfacesShown = props.canRecordSurfaces === true && teeth.length === 1 && surfaceCountForCode(tariff.code) !== null;
  const surfaces = surfacesShown && marked?.tooth === teeth[0] ? surfacesForCode(tariff.code, teeth, marked.surfaces) ?? '' : '';
  const surfaceProblem = surfaceCodeProblem(tariff.code, surfaces);
  const quadrants = isPerQuadrantCode(tariff.code) ? quadrantsOf(teeth) : [];
  const toggle = (tooth: string) =>
    setChosen(current => {
      const next = new Set(current);
      if (next.has(tooth)) next.delete(tooth);
      else next.add(tooth);
      return next;
    });

  const add = () => {
    const outcome = addCodeForTeeth(lines, tariff, teeth, quantity, { tariffs, hasMedicalAid, autoInfectionControl, infectionControlStaff }, { surfaces });
    announceOutcome(outcome, tariff.code);
    if (outcome.status === 'added') onApply(outcome.lines);
  };
  const quadrantWords = listTeeth(quadrants.map(quadrant => quadrantName(quadrant).toLowerCase()));

  return (
    <PickerDialog
      open
      title="Which teeth?"
      subtitle={
        <>
          <span className="font-medium text-gray-700">{tariff.code}</span> {tariff.description}
          {quantity > 1 ? ` · ${quantity} on each tooth` : ''}
        </>
      }
      onClose={onCancel}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600" aria-live="polite">
            {teeth.length === 0
              ? 'Tap the tooth or teeth on the chart.'
              : quadrants.length > 0
                ? quadrants.length === 1
                  ? `The ${quadrantWords} quadrant: one line.`
                  : `The ${quadrantWords} quadrants: one line each.`
                : teeth.length === 1
                  ? `Tooth ${teeth[0]}${surfaces ? `, ${surfaces}` : ''}: one line.`
                  : `Teeth ${listTeeth(teeth)}: one line each.`}
          </p>
          <div className="flex gap-2">
            <button type="button" className={`${secondaryButton} flex-1 sm:flex-none`} onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={`${primaryButton} flex-1 sm:flex-none`}
              disabled={teeth.length === 0 || Boolean(disabledReason) || surfaceProblem !== null}
              onClick={add}
            >
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {quadrants.length > 1 ? `Add for ${quadrants.length} quadrants` : quadrants.length === 0 && teeth.length > 1 ? `Add for ${teeth.length} teeth` : 'Add'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {isPerQuadrantCode(tariff.code)
              ? 'This code is charged per quadrant. Choose a tooth in each quadrant treated.'
              : 'This code is charged per tooth. Choose every tooth treated.'}
          </p>
          <DentitionSwitch value={shown} onChange={setDentition} />
        </div>
        {disabledReason && <MessageList tone="warning" messages={[disabledReason]} />}
        <Odontogram dentition={shown} model={chart.model} mode="select" selected={chosen} onToothClick={toggle} onVisit={onVisit} />
        {surfacesShown && (
          <div>
            <SurfacePicker tooth={teeth[0]} value={surfaces} onChange={next => setMarked({ tooth: teeth[0], surfaces: next })} />
            <p className="mt-1 text-xs text-gray-500">The surfaces filled on tooth {teeth[0]}: printed on the invoice and sent to the medical aid with the code.</p>
          </div>
        )}
        {surfaceProblem && <MessageList tone="warning" messages={[surfaceProblem.message]} />}
      </div>
    </PickerDialog>
  );
};

export default ToothPickerDialog;
