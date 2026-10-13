/**
 * Methealth claim assessment CSV for NMC ("<id>_<practice number>_<batch>.csv"): the fund's answer to
 * a claim batch before it pays. One row per assessed item; a quantity-2 line comes back as two items.
 *
 * The heading row names 35 columns; rows carry the first 27 (the last 8 are for medicines and are
 * filled only on medicine lines). Values are padded with spaces. Status is ASSESSED, PENDED or
 * REJECTED; CODE is the reason code and NOTE its wording. BENEFITAMOUNT is what the fund will pay
 * (on a later statement) and NOT PAID what it will not: no money moves with this file, so it never
 * posts a receipt; it records outcomes and puts rejected and pended items in the rejection queue.
 * The file does not name the fund; NMC is assumed (the importer lets staff change it).
 */
import { identifyFund } from './funds';
import { parseAmountCents, parseDateKey, splitCsvLine, sumOf, textLines } from './text';
import { emptyDocument, emptyLine, type LineStatus, type RemittanceDocument } from './types';

const REQUIRED = ['REFERENCE', 'MEMBER', 'SERV DATE', 'TARIFF', 'CLAIMEDAMOUNT', 'BENEFITAMOUNT', 'CLAIMSTATUS'];
const STATUS_VALUES = /^(ASSESSED|PENDED|REJECTED|PAID|REVERSED)$/i;

const headerOf = (text: string): string[] => splitCsvLine(textLines(text)[0] ?? '').map(name => name.trim().toUpperCase());

export const isNmcResponseCsv = (text: string): boolean => {
  const header = headerOf(text);
  return REQUIRED.every(name => header.includes(name));
};

const statusFrom = (claimStatus: string, claimed: number | null, benefit: number): LineStatus => {
  const status = claimStatus.trim().toUpperCase();
  if (status === 'REJECTED') return 'rejected';
  if (status === 'PENDED') return 'pended';
  const charged = claimed ?? 0;
  if (benefit <= 0 && charged > 0) return 'rejected';
  if (benefit < charged) return 'part_paid';
  return 'accepted';
};

export function parseNmcResponseCsv(text: string): RemittanceDocument {
  const doc = emptyDocument('nmc_response_csv', 'adjudication', 'methealth');
  const rows = textLines(text);
  const header = headerOf(text);
  const column = (name: string) => header.indexOf(name);
  const descriptionIndex = column('DESCRIPTION');
  const statusIndex = column('CLAIMSTATUS');
  const medicineStart = column('NAME');

  let seq = 0;
  let notPaidTotal = 0;
  for (const raw of rows.slice(1)) {
    if (!raw.trim()) continue;
    let fields = splitCsvLine(raw);
    // A description with commas in it (not quoted) pushes later columns right: find the status
    // column again and put the extra pieces back into the description
    if (statusIndex > descriptionIndex && descriptionIndex >= 0 && !STATUS_VALUES.test((fields[statusIndex] ?? '').trim())) {
      const found = fields.findIndex((value, index) => index > statusIndex && STATUS_VALUES.test(value.trim()));
      if (found > statusIndex) {
        const extra = found - statusIndex;
        const description = fields.slice(descriptionIndex, descriptionIndex + extra + 1).join(',');
        fields = [...fields.slice(0, descriptionIndex), description, ...fields.slice(descriptionIndex + extra + 1)];
      }
    }
    const get = (name: string): string => {
      const index = column(name);
      return index >= 0 ? (fields[index] ?? '').trim() : '';
    };
    const serviceDate = parseDateKey(get('SERV DATE'));
    if (!serviceDate) continue;

    if (!doc.practiceNumber) doc.practiceNumber = /^(\d{5,})/.exec(get('HP NO-NAME'))?.[1] ?? null;
    const received = parseDateKey(get('RECEIVED DATE'));
    if (received && (!doc.documentDate || received > doc.documentDate)) doc.documentDate = received;

    seq += 1;
    const line = emptyLine(seq, null);
    line.practiceReference = get('REFERENCE') || null;
    line.memberNumber = get('MEMBER') || null;
    line.memberName = get('MAIN MEMBER') || null;
    const dependant = get('DEP NO');
    line.dependantCode = /^\d{1,2}$/.test(dependant) ? dependant.padStart(2, '0') : dependant || null;
    line.patientName = get('BENEFICIARY') || null;
    line.serviceDate = serviceDate;

    const isMedicine = medicineStart >= 0 && (get('NAPPI') !== '' || get('NAME') !== '') && get('TARIFF') === '';
    line.tariffRaw = (isMedicine ? get('NAPPI') : get('TARIFF')) || null;
    line.description = (isMedicine ? get('NAME') : get('DESCRIPTION')).replace(/\s+/g, ' ') || null;
    const units = Number(isMedicine ? get('QTY') : get('UNITS'));
    line.quantity = Number.isFinite(units) && units > 0 ? units : null;
    line.claimedCents = parseAmountCents(isMedicine ? get('CLAIMED') : get('CLAIMEDAMOUNT'));
    line.tariffCents = parseAmountCents(get('TARIFFAMOUNT'));
    line.paidCents = parseAmountCents(isMedicine ? get('BENEFIT') : get('BENEFITAMOUNT')) ?? 0;
    const notPaid = parseAmountCents(get('NOT PAID'));
    line.memberPortionCents = notPaid;
    notPaidTotal += isMedicine ? Math.max((line.claimedCents ?? 0) - line.paidCents, 0) : notPaid ?? 0;
    line.levyCents = parseAmountCents(get("MEMBER'S LEVY")) ?? 0;
    const code = isMedicine ? get('REJECT CODE') : get('CODE');
    line.reasonCodes = code ? [code] : [];
    const note = (isMedicine ? get('REJECT MESSAGE') : get('NOTE')).replace(/\s+/g, ' ');
    line.reasonTexts = note ? [note] : [];
    if (code && note) doc.reasonLegend[code] = doc.reasonLegend[code] ?? note;
    line.status = statusFrom(isMedicine ? get('STATUS') || get('CLAIMSTATUS') : get('CLAIMSTATUS'), line.claimedCents, line.paidCents);
    const batch = get('BATCH');
    const claim = get('CLAIM NO');
    const item = get('ITEM');
    line.fundClaimRef = batch || claim || item ? [batch, claim, item].join('/') : null;
    doc.lines.push(line);
  }

  const fund = identifyFund('NMC1');
  doc.fundCode = fund?.code ?? null;
  doc.fundName = 'NMC';
  doc.warnings.push('This file does not name the fund. It is read as NMC (Namibia Medical Care); change the fund if it came from another Methealth fund.');
  doc.totalClaimedCents = sumOf(doc.lines.map(line => line.claimedCents));
  doc.totalPaidCents = sumOf(doc.lines.map(line => line.paidCents));
  doc.totalMemberPortionCents = notPaidTotal;
  // On every row the fund's benefit plus what it did not pay equals the amount claimed
  doc.checks.push({
    label: 'Claimed = assessed + not paid',
    expectedCents: doc.totalClaimedCents,
    actualCents: doc.totalPaidCents + notPaidTotal,
    ok: doc.totalClaimedCents === doc.totalPaidCents + notPaidTotal
  });
  if (doc.lines.length === 0) doc.warnings.push('No assessed lines were found in this file.');
  return doc;
}
