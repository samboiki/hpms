import React, { useMemo, useState } from 'react';
import { LabelPrintSheet } from '../labels/LabelPrintSheet';
import type { StockItem } from '../../utils/stock/items';
import { shelfLabel, stockBarcodeLabel, stockLabelCode, type StockLabelItem } from '../../utils/labels/labelContent';
import type { LabelData } from '../../utils/labels/labelSheet';
import { priceOf, stockLevelOf, type StockContext } from './stockContext';

type Kind = 'barcode' | 'shelf';

/** Most labels printed at once: a run of one per unit on hand stops here (a full box of sheets) */
const MAX_LABELS = 1000;

const labelItem = (item: StockItem): StockLabelItem => ({
  name: item.name,
  barcode: item.barcode,
  nappiCode: item.nappiCode,
  sku: item.sku,
  unit: item.unit,
  packSize: item.packSize
});

/**
 * L14: barcode labels (Code 128 of the item's barcode, NAPPI or product code: scanning one finds the item) and shelf
 * labels with the selling price, for the items given (the list as filtered, or one item). Printed through the label
 * printer (src/components/labels).
 */
export const StockLabelsSheet: React.FC<{ context: StockContext; items: readonly StockItem[]; onClose: () => void }> = ({ context, items, onClose }) => {
  const [kind, setKind] = useState<Kind>('barcode');
  const [perUnit, setPerUnit] = useState(false);

  const plan = useMemo(() => {
    const labels: LabelData[] = [];
    const skipped: string[] = [];
    for (const item of items) {
      if (kind === 'shelf') {
        const price = priceOf(item, item.packSize ?? 1, context.settings, context.levels);
        if (!price) {
          skipped.push(item.name);
          continue;
        }
        labels.push(shelfLabel(labelItem(item), price.totalCents));
        continue;
      }
      const label = stockBarcodeLabel(labelItem(item));
      if (!label) {
        skipped.push(item.name);
        continue;
      }
      const times = perUnit ? Math.max(stockLevelOf(item, context.levels).onHand, 0) : 1;
      for (let at = 0; at < times && labels.length < MAX_LABELS; at += 1) labels.push(label);
    }
    return { labels, skipped, capped: labels.length >= MAX_LABELS };
  }, [items, kind, perUnit, context.settings, context.levels]);

  const withCode = items.filter(item => stockLabelCode(labelItem(item))).length;

  return (
    <LabelPrintSheet
      open
      onClose={onClose}
      title={items.length === 1 ? `Labels for ${items[0].name}` : 'Stock labels'}
      subtitle={items.length === 1 ? undefined : `For the ${items.length} items in the list as it is filtered`}
      labels={plan.labels}
      purpose={kind === 'shelf' ? 'shelf' : 'stock'}
      look="cyan"
    >
      <div className="space-y-3">
        <div className="inline-flex rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Which labels">
          {([['barcode', 'Barcode labels'], ['shelf', 'Shelf labels with price']] as const).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${kind === value ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {text}
            </button>
          ))}
        </div>
        {kind === 'barcode' ? (
          <>
            <p className="text-sm text-gray-600">
              Each label carries the item&apos;s barcode, NAPPI code or product code as a barcode: scanning it on the Stock page opens the item.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={perUnit} onChange={event => setPerUnit(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              One label for each unit on hand (to label every box or bottle)
            </label>
          </>
        ) : (
          <p className="text-sm text-gray-600">The selling price including VAT, for the pack size (or one unit), as the bill would charge it today.</p>
        )}
        {plan.skipped.length > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            {kind === 'barcode'
              ? `${plan.skipped.length} of ${items.length} items have no barcode, NAPPI or product code (${withCode} do): add one with Change on the item. `
              : `${plan.skipped.length} items have no price yet (no cost and no selling price). `}
            {plan.skipped.slice(0, 5).join(', ')}{plan.skipped.length > 5 ? '…' : ''}
          </p>
        )}
        {plan.capped && <p className="text-sm text-amber-900" role="status">Only the first {MAX_LABELS} labels are printed at once.</p>}
      </div>
    </LabelPrintSheet>
  );
};

export default StockLabelsSheet;
