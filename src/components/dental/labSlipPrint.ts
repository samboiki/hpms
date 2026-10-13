/**
 * The dental lab slip (parity N5, D28): what goes to the lab with the impression (the work, the teeth or jaw, the
 * shade, the dates, the notes) and, once the lab's invoice is in, its lines with the total billed under 8099. The same
 * page as the optometry lab slip (its head and practice block). Pure: it returns HTML (tested); printing opens it in a
 * print window. Everything printed is escaped.
 */
import { escapeHtml } from '../finance/financeExport';
import { formatServiceDate } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { toothName } from '../../utils/dental/fdi';
import { DENTAL_LAB_STATUS_LABELS, DENTAL_LAB_WORK_LABELS, JAW_LABELS } from '../../utils/dental/labOrders';
import type { DentalLabOrder } from '../../utils/dental/labOrderRecords';
import { LAB_FEE_CODE, labSlipTotalCents } from '../../utils/dental/labSlips';
import { slipHead, slipPracticeBlock, type SlipPatient, type SlipPractice } from '../optometry/slips';

const e = (value: string | number | null | undefined): string => escapeHtml(value === null || value === undefined ? '' : String(value));
const LEFT = ' style="text-align:left"';

/** The slip for one dental lab order. */
export function dentalLabSlipHtml(practice: SlipPractice, patient: SlipPatient, order: DentalLabOrder): string {
  const title = `Lab order ${order.orderNo}`;
  const teeth = order.teeth.map(tooth => `${tooth} (${toothName(tooth).toLowerCase()})`).join(', ');
  const charges =
    order.slipLines.length > 0
      ? `<h2>The lab's invoice${order.slipNumber ? ` ${e(order.slipNumber)}` : ''}</h2><table><thead><tr><th>Code</th><th${LEFT}>What the lab made</th><th>Amount</th></tr></thead><tbody>
${order.slipLines.map(line => `<tr><td>${e(line.code ?? '')}</td><td${LEFT}>${e(line.description)}</td><td>${e(formatNad(fromCents(line.amountCents)))}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="2"${LEFT}><strong>Total, billed under ${LAB_FEE_CODE}</strong></td><td><strong>${e(formatNad(fromCents(labSlipTotalCents(order.slipLines))))}</strong></td></tr></tfoot></table>`
      : '';
  return `${slipHead(title)}${slipPracticeBlock(practice)}<h1>${e(title)}</h1>
<dl><dt>Patient</dt><dd>${e(patient.name)}</dd>
${patient.dateOfBirth ? `<dt>Date of birth</dt><dd>${e(formatServiceDate(patient.dateOfBirth))}</dd>` : ''}
<dt>Sent</dt><dd>${e(formatServiceDate(order.sentOn))}</dd>
${order.dueOn ? `<dt>Needed back by</dt><dd>${e(formatServiceDate(order.dueOn))}</dd>` : ''}
${order.labName ? `<dt>Lab</dt><dd>${e(order.labName)}</dd>` : ''}
${order.status !== 'sent' ? `<dt>Step</dt><dd>${e(DENTAL_LAB_STATUS_LABELS[order.status])} (${e(formatServiceDate(order.statusOn))})</dd>` : ''}</dl>
<h2>Work</h2><dl><dt>Work</dt><dd>${e(DENTAL_LAB_WORK_LABELS[order.workType])}</dd>
${teeth ? `<dt>Teeth (FDI)</dt><dd>${e(teeth)}</dd>` : ''}
${order.jaw ? `<dt>Jaw</dt><dd>${e(JAW_LABELS[order.jaw])}</dd>` : ''}
${order.shade ? `<dt>Shade</dt><dd>${e(order.shade)}</dd>` : ''}</dl>
${order.notes ? `<h2>Notes for the lab</h2><p>${e(order.notes)}</p>` : ''}
${charges}
<div class="sign"><div>Practitioner: ${e(order.createdBy ?? '')}</div><div>Received by the lab</div></div>
</body></html>`;
}
