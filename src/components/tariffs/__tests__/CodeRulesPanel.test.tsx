/**
 * Admin > Tariffs > Practice tariff: what happens when a code is billed (parity E9, D13, O2) and the yearly increase
 * (parity E3). Practice administrators of any discipline set them; other staff see them; nothing is offered before the
 * database update exists.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NO_CODE_RULES, type CodeRules } from '../../../utils/billing/codeRules';
import type { CodeRulesLoad } from '../../../services/codeRulesService';

const rulesService = vi.hoisted(() => ({
  load: { status: 'ready', rules: new Map() } as CodeRulesLoad,
  save: vi.fn(),
  increase: vi.fn()
}));
vi.mock('../../../services/codeRulesService', () => ({
  loadCodeRules: () => Promise.resolve(rulesService.load),
  saveCodeRules: rulesService.save,
  applyTariffIncrease: rulesService.increase
}));
const own = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), portions: vi.fn() }));
vi.mock('../../../services/practiceTariffService', () => ({ saveOwnTariff: own.save, removeOwnTariff: own.remove, saveTariffPortions: own.portions }));
vi.mock('../../../services/icd10DefaultsService', () => ({
  loadTariffIcd10Defaults: () => Promise.resolve({ status: 'ready', defaults: new Map(), message: null }),
  saveTariffIcd10Default: vi.fn()
}));
vi.mock('../../../services/icd10Service', () => ({
  searchIcd10Codes: () => Promise.resolve({ status: 'ready', entries: [] }),
  lookupIcd10Codes: () => Promise.resolve({ status: 'ready', entries: new Map() }),
  knownIcd10Codes: () => null,
  practiceUsualIcd10Codes: () => Promise.resolve([])
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import PracticeTariffPanel from '../PracticeTariffPanel';

const row = (code: string, description: string, price = 450) => ({
  id: `t-${code}`,
  code,
  description,
  price,
  is_active: true,
  effective_from: '2025-01-01',
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO'
});
const GP_ROWS = [row('0190', 'Consultation'), row('0201', 'Dressing', 35), row('0300', 'Wound care', 600)];
const rules = (overrides: Partial<CodeRules>): CodeRules => ({ ...NO_CODE_RULES, ...overrides });

beforeEach(() => {
  rulesService.load = { status: 'ready', rules: new Map() };
  [rulesService.save, rulesService.increase, own.save, own.remove, own.portions].forEach(fn => {
    fn.mockReset();
    fn.mockResolvedValue(undefined);
  });
  rulesService.increase.mockResolvedValue(3);
});

describe('what happens when a code is billed', () => {
  it('lists each code\'s rules in a few words for every member of staff', async () => {
    rulesService.load = { status: 'ready', rules: new Map([['0300', rules({ needsAuthorisation: true, recallMonths: 6, linkedCodes: [{ code: '0201', quantity: 2 }] })]]) };
    render(<PracticeTariffPanel practiceType="medical" tariffRows={GP_ROWS} practiceId="practice-1" canEdit={false} />);
    expect(await screen.findByText('Authorisation, Recall in 6 months, Brings 0201 x2')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'When billed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /what happens when/ })).toBeNull();
  });

  // A GP links a dressing to wound care and asks for the fund's authorisation; "Do not claim" is the code's Who pays
  it('lets an administrator set them for one code, with do not claim saved as who pays', async () => {
    render(
      <PracticeTariffPanel practiceType="medical" tariffRows={GP_ROWS} practiceId="practice-1" canEdit portions={{ map: new Map(), editable: true }} />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Set what happens when 0300 is billed' }));
    const form = screen.getByRole('form', { name: 'When 0300 is billed' });
    fireEvent.click(within(form).getByLabelText(/Needs the fund's authorisation number/));
    fireEvent.click(within(form).getByLabelText(/Do not claim/));
    fireEvent.change(within(form).getByPlaceholderText('No recall'), { target: { value: '12' } });
    fireEvent.change(within(form).getByLabelText('Linked code 1'), { target: { value: '0201' } });
    fireEvent.change(within(form).getByLabelText('Quantity of linked code 1'), { target: { value: '2' } });
    expect(within(form).getByText('Dressing')).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Save the rules' }));

    await waitFor(() =>
      expect(rulesService.save).toHaveBeenCalledWith('practice-1', '0300', rules({ needsAuthorisation: true, recallMonths: 12, linkedCodes: [{ code: '0201', quantity: 2 }] }))
    );
    await waitFor(() => expect(own.portions).toHaveBeenCalledWith('practice-1', new Map([['0300', 'patient']])));
    expect(await screen.findByText('Authorisation, Recall in 1 year, Brings 0201 x2')).toBeInTheDocument();
  });

  it('refuses rules the database would refuse, before anything is saved', async () => {
    render(<PracticeTariffPanel practiceType="medical" tariffRows={GP_ROWS} practiceId="practice-1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set what happens when 0300 is billed' }));
    const form = screen.getByRole('form', { name: 'When 0300 is billed' });
    fireEvent.change(within(form).getByPlaceholderText('e.g. 11'), { target: { value: '99' } });
    fireEvent.change(within(form).getByLabelText('Linked code 1'), { target: { value: '0300' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save the rules' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent(/fund list/);
    expect(alert).toHaveTextContent(/cannot bring itself/);
    expect(rulesService.save).not.toHaveBeenCalled();
  });

  // Dental keeps its built-in 8346 and 8109; the form says so instead of letting them be linked twice
  it('tells a dental practice which codes the app adds by itself', async () => {
    render(<PracticeTariffPanel practiceType="dental" tariffRows={[row('8341', 'Amalgam, one surface')]} practiceId="practice-1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set what happens when 8341 is billed' }));
    expect(screen.getByText(/Built in: 8346 \(material, 10% of this code's price\) follows it/)).toBeInTheDocument();
  });

  it('says in plain words when the database update is not applied, and offers neither the rules nor the increase', async () => {
    rulesService.load = { status: 'not-set-up', rules: new Map() };
    render(<PracticeTariffPanel practiceType="medical" tariffRows={GP_ROWS} practiceId="practice-1" canEdit ownTariffs={{ rows: [], enabled: true }} />);
    expect(await screen.findByText(/proposals\/2026-10-13-tariff-code-rules.sql/)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'When billed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yearly increase' })).toBeNull();
  });
});

describe('the yearly increase', () => {
  it("previews each code's price now and its new price, and applies the ones ticked from the date chosen", async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChanged = vi.fn();
    render(
      <PracticeTariffPanel practiceType="medical" tariffRows={GP_ROWS} practiceId="practice-1" canEdit ownTariffs={{ rows: [], enabled: true }} onChanged={onChanged} />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Yearly increase' }));
    const form = screen.getByRole('form', { name: 'Yearly increase' });
    fireEvent.change(within(form).getByPlaceholderText('e.g. 6'), { target: { value: '6' } });
    fireEvent.change(within(form).getByDisplayValue(/-01-01$/), { target: { value: '2027-01-01' } });
    expect(within(form).getByText('3 of 3 codes go up from 1 Jan 2027. Untick any to leave its price as it is.')).toBeInTheDocument();
    expect(within(form).getByText('N$ 477.00')).toBeInTheDocument();

    // Leave the dressing as it is
    fireEvent.click(within(form).getByLabelText('Put up 0201'));
    fireEvent.click(within(form).getByRole('button', { name: 'Put up 2 prices' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Put 2 prices up by 6% from 1 Jan 2027\?/));
    await waitFor(() => expect(rulesService.increase).toHaveBeenCalledTimes(1));
    const [practiceId, fromDate, items] = rulesService.increase.mock.calls[0];
    expect([practiceId, fromDate]).toEqual(['practice-1', '2027-01-01']);
    expect(items.filter((item: { include: boolean }) => item.include).map((item: { code: string; newPrice: number }) => [item.code, item.newPrice])).toEqual([
      ['0190', 477],
      ['0300', 636]
    ]);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    confirm.mockRestore();
  });

  it('only for practice administrators', async () => {
    render(<PracticeTariffPanel practiceType="medical" tariffRows={GP_ROWS} practiceId="practice-1" canEdit={false} ownTariffs={{ rows: [], enabled: true }} />);
    await screen.findByText('Consultation');
    expect(screen.queryByRole('button', { name: 'Yearly increase' })).toBeNull();
  });
});
