import { describe, expect, it } from 'vitest';
import { LABEL_LAYOUTS, DEFAULT_LAYOUT, labelsPerPage, layoutById, layoutsFor, slotOf } from '../labelLayouts';
import { labelSheetHtml, planLabelSheet, startPosition, type LabelData } from '../labelSheet';
import { frameLabel, mailingLines, mailingRun, priceUnitText, shelfLabel, stockBarcodeLabel, stockLabelCode } from '../labelContent';

const a4 = (id: string) => {
  const layout = layoutById(id);
  if (!layout) throw new Error(id);
  return layout;
};

describe('label layouts', () => {
  it('fits every A4 sheet on the page: no label runs off the paper, so nothing is cut off when printed', () => {
    for (const layout of LABEL_LAYOUTS.filter(entry => entry.kind === 'sheet')) {
      const last = slotOf(layout, labelsPerPage(layout) - 1);
      expect(last.page).toBe(0);
      expect(last.leftMm + layout.labelWidthMm).toBeLessThanOrEqual(layout.pageWidthMm + 0.2);
      expect(last.topMm + layout.labelHeightMm).toBeLessThanOrEqual(layout.pageHeightMm + 0.2);
      expect(layout.pitchXMm).toBeGreaterThanOrEqual(layout.labelWidthMm);
      expect(layout.pitchYMm).toBeGreaterThanOrEqual(layout.labelHeightMm);
    }
  });

  it('numbers positions across a row first, as the sheets are counted when "start at" is typed', () => {
    const layout = a4('a4-21');
    expect(slotOf(layout, 0)).toEqual({ page: 0, leftMm: 7.21, topMm: 15.15 });
    expect(slotOf(layout, 1)).toEqual({ page: 0, leftMm: 73.25, topMm: 15.15 });
    expect(slotOf(layout, 3)).toEqual({ page: 0, leftMm: 7.21, topMm: 53.25 });
    expect(slotOf(layout, 21).page).toBe(1);
  });

  it('offers the sizes that suit a purpose first: small labels for frames, address sheets for mailing', () => {
    expect(layoutsFor('address')[0].suits[0]).toBe('address');
    expect(layoutsFor('frame')[0].suits[0]).toBe('frame');
    for (const purpose of ['address', 'stock', 'shelf', 'frame'] as const) expect(layoutById(DEFAULT_LAYOUT[purpose])).not.toBeNull();
  });
});

const address = (name: string): LabelData => ({ kind: 'address', lines: [name, 'P O Box 1', 'Windhoek'] });

describe('planning and printing a sheet', () => {
  it('starts on a part-used sheet where asked, so the labels already peeled off are skipped', () => {
    const layout = a4('a4-21');
    const plan = planLabelSheet({ layout, labels: Array.from({ length: 5 }, (_, at) => address(`P ${at}`)), startAt: 19 });
    expect(plan).toMatchObject({ labelCount: 5, skipped: 18, pageCount: 2 });
    const html = labelSheetHtml({ layout, labels: [address('First')], startAt: 19 });
    // Position 19 is the first of the last row: left margin, seventh row
    expect(html).toContain('left:7.21mm;top:243.75mm');
  });

  it('prints each label as many times as asked, one after the other', () => {
    const layout = a4('a4-65');
    const html = labelSheetHtml({ layout, labels: [stockBarcodeLabel({ name: 'Gloves', barcode: 'G1', nappiCode: null, sku: null, unit: 'box', packSize: null }) as LabelData], copies: 3 });
    expect(html.match(/class="label"/g)).toHaveLength(3);
    expect(planLabelSheet({ layout, labels: [address('x')], copies: 3 }).labelCount).toBe(3);
  });

  it('ignores "start at" on a label printer and keeps it inside the sheet otherwise', () => {
    expect(startPosition(a4('roll-50x25'), 4)).toBe(1);
    expect(startPosition(a4('a4-21'), 99)).toBe(21);
    expect(startPosition(a4('a4-21'), 0)).toBe(1);
  });

  it('sizes the page for the sheet or for one label, so the printer does not scale it', () => {
    expect(labelSheetHtml({ layout: a4('a4-14'), labels: [address('x')] })).toContain('@page{size:210mm 297mm;margin:0}');
    expect(labelSheetHtml({ layout: a4('roll-50x25'), labels: [address('x'), address('y')] })).toContain('@page{size:50mm 25mm;margin:0}');
    expect(labelSheetHtml({ layout: a4('roll-50x25'), labels: [address('x'), address('y')] }).match(/class="page"/g)).toHaveLength(2);
  });

  it('escapes everything printed, so a name with markup cannot run as code in the print window', () => {
    const html = labelSheetHtml({ layout: a4('a4-21'), labels: [address('<img src=x onerror=alert(1)>')] });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('warns about barcodes too long to scan on a small label, and prints a code that cannot be a barcode as text', () => {
    const long = frameLabel({ code: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
    expect(planLabelSheet({ layout: a4('a4-65'), labels: [long] }).tooLong).toBe(1);
    expect(planLabelSheet({ layout: a4('a4-14'), labels: [long] }).tooLong).toBe(0);
    const odd = frameLabel({ code: 'Frame–1' });
    expect(planLabelSheet({ layout: a4('a4-65'), labels: [odd] }).unencodable).toBe(1);
    const html = labelSheetHtml({ layout: a4('a4-65'), labels: [odd] });
    expect(html).not.toContain('<svg');
    expect(html).toContain('Frame–1');
  });

  it('draws outlines only when asked (to line the printer up on plain paper)', () => {
    expect(labelSheetHtml({ layout: a4('a4-21'), labels: [address('x')], outlines: true })).toContain('<body class="outlines">');
    expect(labelSheetHtml({ layout: a4('a4-21'), labels: [address('x')] })).toContain('<body class="">');
  });

  it('moves every label by the line-up offset', () => {
    const html = labelSheetHtml({ layout: a4('a4-21'), labels: [address('x')], offset: { xMm: 1.5, yMm: -2 } });
    expect(html).toContain('left:8.71mm;top:13.15mm');
  });
});

describe('what goes on the labels', () => {
  it('addresses a mailing label to the formal name with the postal address split into lines', () => {
    expect(mailingLines({ title: 'Mrs', initials: 'NM', firstName: 'Ndapewa', lastName: 'Shilongo', postalAddress: 'P O Box 2210, Ondangwa', postalCode: '9000' }))
      .toEqual(['Mrs N M Shilongo', 'P O Box 2210', 'Ondangwa 9000']);
  });

  it('falls back to the home address, and gives no label without any address', () => {
    expect(mailingLines({ firstName: 'Tjihimise', lastName: 'Kandjii', homeAddress: '12 Erf Street\nKhomasdal' }))
      .toEqual(['Tjihimise Kandjii', '12 Erf Street', 'Khomasdal']);
    expect(mailingLines({ firstName: 'Tjihimise', lastName: 'Kandjii' })).toBeNull();
  });

  it('can send one label per household, so a family on a list is not posted the same letter twice', () => {
    const shared = { postalAddress: 'P O Box 5, Rundu' };
    const patients = [
      { patientId: 'a', name: 'Anna Haufiku', source: { firstName: 'Anna', lastName: 'Haufiku', ...shared } },
      { patientId: 'b', name: 'Paulus Haufiku', source: { firstName: 'Paulus', lastName: 'Haufiku', postalAddress: 'p o box 5,  RUNDU' } },
      { patientId: 'c', name: 'Selma Ipinge', source: { firstName: 'Selma', lastName: 'Ipinge' } }
    ];
    const each = mailingRun(patients, { onePerAddress: false });
    expect(each.labels).toHaveLength(2);
    expect(each.withoutAddress).toEqual([{ patientId: 'c', name: 'Selma Ipinge' }]);
    const households = mailingRun(patients, { onePerAddress: true });
    expect(households.labels).toHaveLength(1);
    expect(households.sameAddress).toBe(1);
  });

  it('prints the code the Stock page finds when scanned: the barcode, else the NAPPI code, else the product code', () => {
    expect(stockLabelCode({ barcode: '6001234567890', nappiCode: '700123001', sku: 'G-1' })).toBe('6001234567890');
    expect(stockLabelCode({ barcode: null, nappiCode: '700123001', sku: 'G-1' })).toBe('700123001');
    expect(stockLabelCode({ barcode: ' ', nappiCode: null, sku: 'G-1' })).toBe('G-1');
    expect(stockBarcodeLabel({ name: 'Gauze', barcode: null, nappiCode: null, sku: null, unit: 'pack', packSize: null })).toBeNull();
  });

  it('says what a shelf price is for, including VAT', () => {
    const label = shelfLabel({ name: 'Paracetamol 500 mg', barcode: null, nappiCode: '700123001', sku: null, unit: 'tablet', packSize: 20 }, 4550);
    expect(label).toMatchObject({ kind: 'shelf', priceCents: 4550, priceNote: 'per pack of 20 tablets, incl. VAT', code: '700123001' });
    expect(priceUnitText({ unit: 'box', packSize: null })).toBe('box');
  });

  it('builds a frame tag from what the optometry screens hold', () => {
    expect(frameLabel({ code: ' FR000123 ', brand: 'Ray-Ban', model: 'RB5154', colour: 'Black', size: '51-21-145', priceCents: 189900 }))
      .toEqual({ kind: 'frame', code: 'FR000123', title: 'Ray-Ban RB5154', detail: 'Black · 51-21-145', priceCents: 189900 });
    expect(frameLabel({ code: 'F1' })).toMatchObject({ title: 'Frame', detail: null, priceCents: null });
  });
});
