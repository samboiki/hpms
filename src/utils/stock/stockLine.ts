/**
 * A stock item as a line on the visit's bill. The line carries the item's id as its tariff id: the visit screens
 * keep tariff ids when they save the lines again, and the database recognises the item from it (it fills
 * invoice_services.stock_item_id and nappi_code and takes the units off stock; proposals/2026-10-07-dispensing-and-
 * stock.sql, section 14). The price is the item's, worked out by priceStockLine.
 */
import type { ServiceSelection } from '../../types/billing';
import { fromCents } from '../billing/money';
import { billingCodeFor, type StockItem } from './items';
import type { PricedLine } from './pricing';

export interface StockLineInput {
  item: Pick<StockItem, 'id' | 'name' | 'nappiCode' | 'tariffCode' | 'sku' | 'category'>;
  quantity: number;
  price: PricedLine;
  /** From the patient's medical aid record, as the visit screen decides for its other lines */
  hasMedicalAid: boolean;
  /** A new id for the line on screen */
  lineId: string;
}

export function stockBillingLine(input: StockLineInput): ServiceSelection {
  const { item, quantity, price } = input;
  return {
    id: input.lineId,
    tariffId: item.id,
    code: billingCodeFor(item),
    description: item.name.slice(0, 200),
    category: item.category === 'medications' ? 'Medicine' : 'Stock',
    unitPrice: fromCents(price.unitPriceCents),
    quantity,
    totalPrice: fromCents(price.totalCents),
    medicalAidCovered: input.hasMedicalAid,
    coveragePercentage: input.hasMedicalAid ? 100 : 0,
    canBeMultiplied: true
  };
}

/** Lines of the bill that are stock items (their tariff id is an item id), with the units each bills */
export function stockUnitsOnBill(lines: readonly Pick<ServiceSelection, 'tariffId' | 'quantity'>[], itemIds: ReadonlySet<string>): Map<string, number> {
  const units = new Map<string, number>();
  for (const line of lines) {
    if (itemIds.has(line.tariffId)) units.set(line.tariffId, (units.get(line.tariffId) ?? 0) + line.quantity);
  }
  return units;
}
