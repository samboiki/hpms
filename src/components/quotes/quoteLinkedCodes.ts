/**
 * Linked codes on a quote (parity D13), the same way as on a visit (visits/linkedCodeLines.ts, the one rule): a code
 * staff add to the quote, from the code search or a bundle, brings the codes the practice linked to it (Admin >
 * Tariffs > Practice tariff), each priced from its own tariff for this patient, right after it. Staff see them in the
 * quote at once ("Added with ...") and can remove any before saving; removing the code before saving removes them too
 * (billingLines.removeLine). The lines a saved quote opens with bring nothing again, as on a visit.
 * So a quote holds the lines the visit's invoice will get.
 */
import type { ServiceSelection } from '../../types/billing';
import { addLinkedLines, linkedCodesText, type LinkedLinesResult, type RuledVisitTariff } from '../visits/linkedCodeLines';

/**
 * The quote's lines after an addition (`after`, from the code search or a bundle), with the linked codes of the lines
 * that were not there before (`before`) put in after each of them. Nothing new: the lines as they are.
 */
export function withLinkedCodes(
  before: readonly ServiceSelection[],
  after: readonly ServiceSelection[],
  tariffs: readonly RuledVisitTariff[],
  options: { hasMedicalAid: boolean; dental: boolean }
): LinkedLinesResult {
  const known = new Set(before.map(line => line.id));
  const fresh = new Set(after.filter(line => !known.has(line.id)).map(line => line.id));
  if (fresh.size === 0) return { services: [...after], added: [], problems: [] };
  return addLinkedLines(after, fresh, tariffs, options);
}

/**
 * A quote made in one tap from the dental treatment plan is saved straight away with the linked codes of its work
 * (planPricing.ts): staff are told what came with what, and that the quote can still be changed.
 */
export function describeQuotedLinks(added: LinkedLinesResult['added']): string {
  return `The quote also has the practice's linked codes: ${linkedCodesText(added)}. Edit the quote to remove any you do not need.`;
}
