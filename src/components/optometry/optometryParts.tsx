/**
 * Small shared pieces of the optometry screens: the prescription table, status chips, section cards and the "not set
 * up yet" notice. The look (buttons, inputs, cards) is the stock screens' (stockUi), so the clinical and stock parts
 * of an optometry practice look the same.
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { Chip } from '../stock/stockParts';
import { CARD } from '../stock/stockUi';
import { EYE_LETTERS, EYE_NAMES, EYES, describeChange, formatDioptre, type EyeChange, type Rx, type RxKind } from '../../utils/optometry/prescription';
import { LAB_STATUS_LABELS, type LabOrderStatus } from '../../utils/optometry/labOrders';
import { SUPPLY_STATUS_LABELS, type SupplyStatus } from '../../utils/optometry/contactLenses';
import { FRAME_STATUS_LABELS, type FrameStatus } from '../../utils/optometry/frames';

/** Shown wherever eye records are used before the database update is applied */
export const EyesNotSetUp: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={`${CARD} flex items-start gap-3 ${compact ? 'p-3' : 'p-5'}`} role="status">
    <Icon icon="solar:eye-bold-duotone" className="mt-0.5 h-6 w-6 flex-shrink-0 text-cyan-500" aria-hidden="true" />
    <div className="text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Eye records are not set up yet</p>
      <p className="mt-0.5">
        Prescriptions, eye exams, lab orders and contact lenses can be recorded once your administrator applies the optometry
        update to the practice&apos;s database. Nothing is lost in the meantime: visits and billing work as before.
      </p>
    </div>
  </div>
);

/** A titled card with an optional action on the right */
export const Section: React.FC<{ title: string; icon: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  subtitle,
  action,
  children
}) => (
  <section className={`${CARD} p-4 sm:p-5`} aria-label={title}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2">
        <Icon icon={icon} className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-600" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
    {children}
  </section>
);

const None: React.FC = () => (
  <>
    <span className="text-gray-300" aria-hidden="true">
      —
    </span>
    <span className="sr-only">none</span>
  </>
);

const cell = 'px-2 py-1.5 text-right tabular-nums';

/**
 * One prescription, right eye above left, as optometrists read it. Prism and vision columns show only when the
 * prescription has them; contact lenses add base curve and diameter.
 */
export const RxTable: React.FC<{ rx: Rx; kind: RxKind; caption: string }> = ({ rx, kind, caption }) => {
  const eyes = EYES.map(side => ({ side, eye: rx[side] }));
  const showPrism = kind === 'spectacles' && eyes.some(({ eye }) => eye.prism);
  const showVa = eyes.some(({ eye }) => eye.va);
  const showLens = kind === 'contact_lenses';
  const dioptre = (value: number | null) => (value ? formatDioptre(value) : <None />);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full min-w-[18rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">Eye</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Sphere</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Cyl</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Axis</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Add</th>
            {showPrism && <th scope="col" className="px-2 py-1.5 text-right font-medium">Prism</th>}
            {showLens && <th scope="col" className="px-2 py-1.5 text-right font-medium">BC</th>}
            {showLens && <th scope="col" className="px-2 py-1.5 text-right font-medium">Dia</th>}
            {showVa && <th scope="col" className="px-2 py-1.5 text-right font-medium">Vision</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-900">
          {eyes.map(({ side, eye }) => (
            <tr key={side}>
              <th scope="row" className="px-2 py-1.5 text-left font-semibold">
                <abbr title={EYE_NAMES[side]} className="no-underline">{EYE_LETTERS[side]}</abbr>
              </th>
              <td className={cell}>{formatDioptre(eye.sphere, { plano: true })}</td>
              <td className={cell}>{dioptre(eye.cylinder)}</td>
              <td className={cell}>{eye.cylinder && eye.axis !== null ? eye.axis : <None />}</td>
              <td className={cell}>{dioptre(eye.add)}</td>
              {showPrism && <td className={cell}>{eye.prism && eye.base ? `${eye.prism.toFixed(2)} ${eye.base}` : <None />}</td>}
              {showLens && <td className={cell}>{eye.baseCurve ?? <None />}</td>}
              {showLens && <td className={cell}>{eye.diameter ?? <None />}</td>}
              {showVa && <td className={cell}>{eye.va ?? <None />}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** "Right eye: sphere -0.25 · Left eye: no change" */
export const ChangeLine: React.FC<{ since: string; change: { right: EyeChange; left: EyeChange } }> = ({ since, change }) => (
  <p className="mt-2 text-xs text-gray-600">
    <span className="font-medium text-gray-700">Since {since}:</span>{' '}
    {EYES.map(side => `${EYE_NAMES[side]}: ${describeChange(change[side]).toLowerCase()}`).join(' · ')}
  </p>
);

const LAB_TONES: Readonly<Record<LabOrderStatus, 'gray' | 'green' | 'amber' | 'red' | 'cyan' | 'violet'>> = {
  ordered: 'cyan',
  received: 'violet',
  fitted: 'green',
  collected: 'gray',
  remake: 'amber',
  cancelled: 'red'
};

export const LabStatusChip: React.FC<{ status: LabOrderStatus }> = ({ status }) => <Chip tone={LAB_TONES[status]}>{LAB_STATUS_LABELS[status]}</Chip>;

const SUPPLY_TONES: Readonly<Record<SupplyStatus, 'gray' | 'green' | 'amber' | 'red' | 'cyan' | 'violet'>> = {
  ordered: 'cyan',
  received: 'violet',
  collected: 'green',
  cancelled: 'red'
};

export const SupplyStatusChip: React.FC<{ status: SupplyStatus }> = ({ status }) => <Chip tone={SUPPLY_TONES[status]}>{SUPPLY_STATUS_LABELS[status]}</Chip>;

const FRAME_TONES: Readonly<Record<FrameStatus, 'gray' | 'green' | 'amber' | 'red' | 'cyan' | 'violet'>> = {
  in_stock: 'green',
  on_order: 'violet',
  sold: 'gray',
  none: 'amber'
};

export const FrameStatusChip: React.FC<{ status: FrameStatus }> = ({ status }) => <Chip tone={FRAME_TONES[status]}>{FRAME_STATUS_LABELS[status]}</Chip>;

/** A row of "label: value" facts that wraps on small screens */
export const Facts: React.FC<{ items: ReadonlyArray<[string, React.ReactNode | null | undefined]> }> = ({ items }) => (
  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
    {items.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
      <div key={label} className="flex gap-1">
        <dt className="text-gray-500">{label}:</dt>
        <dd className="font-medium text-gray-800">{value}</dd>
      </div>
    ))}
  </dl>
);
