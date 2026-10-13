/**
 * The printed prescription (for the patient) and the lab order slip (for the lab). Pure: they take the records and
 * return HTML (tested); printing opens it in a print window (printDocument). Everything printed is escaped.
 */
import { escapeHtml } from '../finance/financeExport';
import { printDocument } from '../finance/receipts/receiptDocuments';
import { formatServiceDate } from '../../utils/billing/dates';
import {
  EYE_LETTERS,
  EYES,
  PRISM_BASE_LABELS,
  RX_KIND_LABELS,
  formatDioptre,
  type EyeRx,
  type EyeSide
} from '../../utils/optometry/prescription';
import { LAB_EYES_LABELS, LENS_COATING_LABELS, LENS_MATERIAL_LABELS, LENS_TYPE_LABELS, orderedSides } from '../../utils/optometry/labOrders';
import type { LabOrderRecord, PrescriptionRecord } from '../../utils/optometry/records';

export interface SlipPractice {
  name: string;
  phone: string | null;
  address: string | null;
  practiceNumber: string | null;
}

export interface SlipPatient {
  name: string;
  dateOfBirth: string | null;
}

const e = (value: string | number | null | undefined): string => escapeHtml(value === null || value === undefined ? '' : String(value));
const dash = '&ndash;';

const head = (title: string): string => `<!doctype html><html><head><meta charset="utf-8"><title>${e(title)}</title><style>
@page{size:A4;margin:14mm}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:0;font-size:11pt}
h1{font-size:15pt;margin:0 0 2mm}h2{font-size:12pt;margin:6mm 0 2mm}
.practice{border-bottom:1px solid #999;padding-bottom:3mm;margin-bottom:5mm}.small{font-size:9pt;color:#333}
table{border-collapse:collapse;width:100%;margin-top:2mm}th,td{border:1px solid #999;padding:1.5mm 2mm;text-align:right}
th:first-child,td:first-child{text-align:left}thead th{background:#f2f2f2;font-size:9.5pt}
dl{display:grid;grid-template-columns:max-content 1fr;gap:1mm 4mm;margin:0}dt{color:#444}dd{margin:0;font-weight:600}
.sign{margin-top:14mm;display:flex;gap:10mm}.sign div{flex:1;border-top:1px solid #333;padding-top:1mm;font-size:9pt}
</style></head><body>`;

const practiceBlock = (practice: SlipPractice): string => `<div class="practice"><strong>${e(practice.name)}</strong>
${practice.address ? `<div class="small">${e(practice.address)}</div>` : ''}
<div class="small">${[practice.phone ? `Tel ${e(practice.phone)}` : '', practice.practiceNumber ? `Practice no. ${e(practice.practiceNumber)}` : ''].filter(Boolean).join(' &middot; ')}</div></div>`;

const dioptre = (value: number | null): string => (value ? e(formatDioptre(value)) : dash);

const eyeRow = (side: EyeSide, eye: EyeRx, columns: { prism: boolean; lens: boolean }): string => `<tr><td><strong>${EYE_LETTERS[side]}</strong></td>
<td>${e(formatDioptre(eye.sphere, { plano: true }))}</td><td>${dioptre(eye.cylinder)}</td><td>${eye.cylinder && eye.axis !== null ? e(eye.axis) : dash}</td>
<td>${dioptre(eye.add)}</td>${columns.prism ? `<td>${eye.prism && eye.base ? `${e(eye.prism.toFixed(2))} ${e(PRISM_BASE_LABELS[eye.base])}` : dash}</td>` : ''}
${columns.lens ? `<td>${eye.baseCurve ?? dash}</td><td>${eye.diameter ?? dash}</td>` : ''}<td>${eye.va ? e(eye.va) : dash}</td></tr>`;

const rxTable = (rx: PrescriptionRecord, sides: readonly EyeSide[] = EYES): string => {
  const columns = { prism: rx.kind === 'spectacles' && EYES.some(side => rx[side].prism), lens: rx.kind === 'contact_lenses' };
  return `<table><thead><tr><th>Eye</th><th>Sphere</th><th>Cylinder</th><th>Axis</th><th>Add</th>${columns.prism ? '<th>Prism</th>' : ''}
${columns.lens ? '<th>Base curve</th><th>Diameter</th>' : ''}<th>Vision</th></tr></thead>
<tbody>${sides.map(side => eyeRow(side, rx[side], columns)).join('')}</tbody></table>`;
};

/** The prescription the patient takes away: practice, patient, both eyes, date, valid until, practitioner. */
export function prescriptionSlipHtml(practice: SlipPractice, patient: SlipPatient, rx: PrescriptionRecord): string {
  const title = `${RX_KIND_LABELS[rx.kind]} prescription`;
  return `${head(title)}${practiceBlock(practice)}<h1>${e(title)}</h1>
<dl><dt>Patient</dt><dd>${e(patient.name)}</dd>
${patient.dateOfBirth ? `<dt>Date of birth</dt><dd>${e(formatServiceDate(patient.dateOfBirth))}</dd>` : ''}
<dt>Date</dt><dd>${e(formatServiceDate(rx.prescribedOn))}</dd>
${rx.validUntil ? `<dt>Valid until</dt><dd>${e(formatServiceDate(rx.validUntil))}</dd>` : ''}
${rx.lensName ? `<dt>Lenses</dt><dd>${e(rx.lensName)}</dd>` : ''}
${rx.outsideSource ? `<dt>Prescribed by</dt><dd>${e(rx.outsideSource)} (copied)</dd>` : ''}</dl>
${rxTable(rx)}
${rx.notes ? `<p class="small">${e(rx.notes)}</p>` : ''}
<div class="sign"><div>${e(rx.outsideSource ? 'Copied by' : 'Practitioner')}: ${e(rx.recordedBy ?? '')}${rx.recordedByNumber ? ` (HPCNA ${e(rx.recordedByNumber)})` : ''}</div><div>Signature</div></div>
</body></html>`;
}

/** The lab's copy of an order: the prescription of the eyes ordered, the lens, the measurements and the frame. */
export function labOrderSlipHtml(practice: SlipPractice, patient: SlipPatient, order: LabOrderRecord, rx: PrescriptionRecord | null): string {
  const title = `Lab order ${order.orderNo}`;
  const sides = orderedSides(order.eyes);
  const measure = (value: number | null) => (value === null ? dash : `${e(value.toFixed(1))} mm`);
  return `${head(title)}${practiceBlock(practice)}<h1>${e(title)}</h1>
<dl><dt>Patient</dt><dd>${e(patient.name)}</dd><dt>Ordered</dt><dd>${e(formatServiceDate(order.orderedOn))}</dd>
${order.requiredBy ? `<dt>Needed by</dt><dd>${e(formatServiceDate(order.requiredBy))}</dd>` : ''}
${order.supplierName ? `<dt>Lab</dt><dd>${e(order.supplierName)}</dd>` : ''}
${order.labReference ? `<dt>Lab reference</dt><dd>${e(order.labReference)}</dd>` : ''}
<dt>Eyes</dt><dd>${e(LAB_EYES_LABELS[order.eyes])}</dd></dl>
<h2>Prescription</h2>${rx ? rxTable(rx, sides) : '<p>Prescription not found.</p>'}
<h2>Lenses</h2><dl><dt>Type</dt><dd>${e(LENS_TYPE_LABELS[order.lensType])}</dd><dt>Material</dt><dd>${e(LENS_MATERIAL_LABELS[order.material])}</dd>
<dt>Coatings</dt><dd>${order.coatings.length > 0 ? order.coatings.map(coating => e(LENS_COATING_LABELS[coating])).join(', ') : 'None'}</dd>
${order.tintPercent ? `<dt>Tint</dt><dd>${e(order.tintPercent)} %${order.tintColour ? ` ${e(order.tintColour)}` : ''}</dd>` : ''}</dl>
<h2>Measurements</h2><table><thead><tr><th>Eye</th><th>Pupil distance</th><th>Fitting height</th></tr></thead><tbody>
${sides.map(side => `<tr><td><strong>${EYE_LETTERS[side]}</strong></td><td>${measure(side === 'right' ? order.pdRight : order.pdLeft)}</td><td>${measure(side === 'right' ? order.heightRight : order.heightLeft)}</td></tr>`).join('')}
</tbody></table>
<h2>Frame</h2><p>${e(order.frameName ?? '')}${order.frameName && order.frameNote ? ' &middot; ' : ''}${e(order.frameNote ?? '')}</p>
${order.notes ? `<h2>Notes</h2><p>${e(order.notes)}</p>` : ''}
<div class="sign"><div>Ordered by: ${e(order.createdBy ?? '')}</div><div>Checked on return</div></div>
</body></html>`;
}

/** Opens the print window straight from the click (a browser blocks one opened later). False when it was blocked. */
export const printSlip = (html: string): boolean => printDocument(html);

/** The page head and practice block every lab slip shares (the dental lab slip too: src/components/dental/labSlipPrint.ts). */
export { head as slipHead, practiceBlock as slipPracticeBlock };
