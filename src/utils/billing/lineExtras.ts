/**
 * The billing extras a stored invoice line carries (proposals/2026-10-13-billing-extras.sql): the promotion its discount
 * came from and the prepaid package it was paid from. The visit screens read them back with the line, so saving the
 * visit again keeps them (invoiceLineRow.ts writes them).
 */
import type { ServiceSelection } from '../../types/billing';

const idText = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export const lineExtrasFromRow = (row: { promotion_id?: unknown; package_id?: unknown }): Pick<ServiceSelection, 'promotionId' | 'packageId'> => {
  const promotionId = idText(row.promotion_id);
  const packageId = idText(row.package_id);
  return { ...(promotionId ? { promotionId } : {}), ...(packageId ? { packageId } : {}) };
};
