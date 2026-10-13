/**
 * Admin > Tariffs > Practice tariff: the usual ICD-10 code per tariff code (parity E8). Practice administrators choose
 * it for any discipline; dental practices see the built-in suggestion until they do.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Icd10DefaultsLoad } from '../../../services/icd10DefaultsService';

const mocks = vi.hoisted(() => ({
  load: { status: 'ready', defaults: new Map([['8101', 'K02.1']]), message: null } as Icd10DefaultsLoad,
  save: vi.fn()
}));
vi.mock('../../../services/icd10DefaultsService', () => ({
  loadTariffIcd10Defaults: () => Promise.resolve(mocks.load),
  saveTariffIcd10Default: mocks.save
}));

const own = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), portions: vi.fn() }));
vi.mock('../../../services/practiceTariffService', () => ({
  saveOwnTariff: own.save,
  removeOwnTariff: own.remove,
  saveTariffPortions: own.portions
}));
// What happens when a code is billed and the yearly increase are tested in CodeRulesPanel.test.tsx; none here
vi.mock('../../../services/codeRulesService', () => ({
  loadCodeRules: () => Promise.resolve({ status: 'ready', rules: new Map() }),
  saveCodeRules: vi.fn(),
  applyTariffIncrease: vi.fn()
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
// The usual code is typed into the shared ICD-10 search; its list stays out of these tests (no database)
vi.mock('../../../services/icd10Service', () => ({
  searchIcd10Codes: () => Promise.resolve({ status: 'ready', entries: [] }),
  lookupIcd10Codes: () => Promise.resolve({ status: 'ready', entries: new Map() }),
  knownIcd10Codes: () => null,
  practiceUsualIcd10Codes: () => Promise.resolve([])
}));

import PracticeTariffPanel from '../PracticeTariffPanel';

const row = (code: string, description: string) => ({
  id: `t-${code}`,
  code,
  description,
  price: 450,
  is_active: true,
  effective_from: '2025-01-01',
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO'
});
const rows = [row('8101', 'Oral examination'), row('8109', 'Infection control'), row('8341', 'Amalgam, one surface')];

beforeEach(() => {
  mocks.load = { status: 'ready', defaults: new Map([['8101', 'K02.1']]), message: null };
  mocks.save.mockReset();
  mocks.save.mockResolvedValue(undefined);
  [own.save, own.remove, own.portions].forEach(fn => {
    fn.mockReset();
    fn.mockResolvedValue(undefined);
  });
});

describe("a practice's usual ICD-10 codes", () => {
  it("shows the practice's own code, else the built-in dental suggestion marked as such", async () => {
    render(<PracticeTariffPanel practiceType="dental" tariffRows={rows} practiceId="practice-1" canEdit />);
    expect(await screen.findByText('K02.1')).toBeInTheDocument();
    // 8109's usual diagnosis in the funds' accepted claims
    expect(screen.getByText('Z01.2')).toBeInTheDocument();
    expect(screen.getAllByText('built-in').length).toBeGreaterThan(0);
  });

  // The code becomes the main code of every new line for the tariff code, so one the claim would refuse never gets saved
  it('lets an administrator set a code, refusing one that cannot be a main code before saving', async () => {
    render(<PracticeTariffPanel practiceType="general_practice" tariffRows={[row('0190', 'Consultation')]} practiceId="practice-1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set the usual ICD-10 code for 0190' }));
    const field = screen.getByLabelText('Usual ICD-10 code for 0190');
    fireEvent.change(field, { target: { value: 'w01.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be the main code/);
    expect(mocks.save).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'j069' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('practice-1', '0190', 'J06.9'));
    expect(await screen.findByText('J06.9')).toBeInTheDocument();
  });

  it('lets an administrator clear the practice\'s code', async () => {
    render(<PracticeTariffPanel practiceType="dental" tariffRows={rows} practiceId="practice-1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change the usual ICD-10 code for 8101' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('practice-1', '8101', null));
  });

  it('shows the codes to other staff without letting them change them', async () => {
    render(<PracticeTariffPanel practiceType="dental" tariffRows={rows} practiceId="practice-1" canEdit={false} />);
    expect(await screen.findByText('K02.1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /usual ICD-10 code/ })).toBeNull();
  });

  it('says so in plain words when the database update is not applied, and offers no changes', async () => {
    mocks.load = { status: 'not-set-up', defaults: new Map(), message: null };
    render(<PracticeTariffPanel practiceType="dental" tariffRows={rows} practiceId="practice-1" canEdit />);
    expect(await screen.findByText(/not set up yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /usual ICD-10 code/ })).toBeNull();
  });
});

// Parity E13: a practice prices its own codes without touching the shared list or another practice. Parity D8: each
// code can start its lines paid by one side only.
describe("the practice's own codes and who pays them", () => {
  const ownRow = {
    id: 'own-1',
    practice_id: 'practice-1',
    code: '0190',
    description: 'Consultation (own price)',
    price: 500,
    can_be_multiplied: 'NO',
    requires_tooth_number: 'NO',
    effective_from: '2026-01-01',
    is_active: true
  };

  it("bills the practice's own price over the shared one and marks it as the practice's own", async () => {
    render(
      <PracticeTariffPanel practiceType="general_practice" tariffRows={[row('0190', 'Consultation')]} practiceId="practice-1" canEdit ownTariffs={{ rows: [ownRow], enabled: true }} />
    );
    expect(await screen.findByText('Consultation (own price)')).toBeInTheDocument();
    expect(screen.getByText("Practice's own")).toBeInTheDocument();
    expect(screen.getByText('N$ 500.00')).toBeInTheDocument();
    expect(screen.queryByText('N$ 450.00')).toBeNull();
  });

  // The database refuses the same: saying so first saves the administrator a round trip
  it('adds a code, refusing a malformed one before anything is saved', async () => {
    render(<PracticeTariffPanel practiceType="general_practice" tariffRows={[]} practiceId="practice-1" canEdit ownTariffs={{ rows: [], enabled: true }} onChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a code' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 0190'), { target: { value: 'GP 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/1 to 10 letters or digits/);
    expect(own.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('e.g. 0190'), { target: { value: 'gp1' } });
    fireEvent.change(screen.getByPlaceholderText('What the patient and the fund see on the invoice'), { target: { value: 'Consultation' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 450.00'), { target: { value: '350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the code' }));
    await waitFor(() => expect(own.save).toHaveBeenCalledWith('practice-1', expect.objectContaining({ code: 'GP1', description: 'Consultation', price: '350' })));
  });

  it('saves who pays new lines of a code', async () => {
    render(<PracticeTariffPanel practiceType="general_practice" tariffRows={[row('0190', 'Consultation')]} practiceId="practice-1" canEdit portions={{ map: new Map(), editable: true }} />);
    fireEvent.change(await screen.findByLabelText('Who pays new lines of 0190'), { target: { value: 'patient' } });
    await waitFor(() => expect(own.portions).toHaveBeenCalledWith('practice-1', new Map([['0190', 'patient']])));
  });

  it('shows other staff who pays, without letting them change it or add codes', async () => {
    render(
      <PracticeTariffPanel
        practiceType="general_practice"
        tariffRows={[row('0190', 'Consultation')]}
        practiceId="practice-1"
        canEdit={false}
        ownTariffs={{ rows: [], enabled: true }}
        portions={{ map: new Map([['0190', 'patient' as const]]), editable: true }}
      />
    );
    expect(await screen.findByText('Patient pays all (not claimed)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a code' })).toBeNull();
    expect(screen.queryByLabelText('Who pays new lines of 0190')).toBeNull();
  });
});
