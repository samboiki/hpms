/**
 * Admin > Tariffs > Practice tariff says which NAMAF benchmark list the practice bills from, where it came from and how
 * long it is valid (parity E1). Why: staff must know the prices they bill are NAMAF's for every fund, and a practice
 * whose type does not say its discipline (an anaesthetist in a 'medical' practice, a private hospital) must be able to
 * bill from its own discipline's list. Invented practice.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
const service = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('../../../services/namafTariffService', () => ({ saveChosenDiscipline: service.save }));

import NamafListNote from '../NamafListNote';
import type { NamafLoad } from '../../../services/namafTariffService';

const disciplines = [
  { discipline_code: '014', discipline_name: 'GENERAL PRACTITIONER', codes: 2201, priced_codes: 1994, valid_from: '2026-01-01', valid_to: '2026-12-31' },
  { discipline_code: '010', discipline_name: 'ANAESTHETIST', codes: 2221, priced_codes: 2169, valid_from: '2026-01-01', valid_to: '2026-12-31' },
  { discipline_code: '004', discipline_name: 'CHIROPRACTOR', codes: 77, priced_codes: 63, valid_from: '2026-01-01', valid_to: '2026-12-31' }
];
const ready: NamafLoad = { status: 'ready', discipline: '014', chosen: false, typeDiscipline: '014', tariffs: [] };

beforeEach(() => {
  service.save.mockReset();
  service.save.mockResolvedValue(undefined);
});

describe('the NAMAF list on the Tariffs page', () => {
  it('names the list, its size, its dates and that it applies to every fund', () => {
    render(<NamafListNote practiceId="p1" practiceType="medical" canEdit={false} namaf={ready} disciplines={disciplines} onChanged={vi.fn()} />);
    const note = screen.getByLabelText('NAMAF benchmark list');
    expect(note).toHaveTextContent('NAMAF 2026 benchmark list for General practitioner (014): 2,201 codes, 1,994 with a fixed amount, valid 1 Jan 2026 to 31 Dec 2026');
    expect(note).toHaveTextContent('It applies to every medical aid');
    expect(note).toHaveTextContent('staff type the amount when they bill them');
    // Only administrators change the list
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it("lets an administrator bill from another discipline's list, and go back to the practice type's", async () => {
    const onChanged = vi.fn();
    const { rerender } = render(<NamafListNote practiceId="p1" practiceType="medical" canEdit namaf={ready} disciplines={disciplines} onChanged={onChanged} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveDisplayValue("The practice type's: General practitioner (014)");
    fireEvent.change(select, { target: { value: '010' } });
    await waitFor(() => expect(service.save).toHaveBeenCalledWith('p1', '010'));
    expect(onChanged).toHaveBeenCalled();
    rerender(<NamafListNote practiceId="p1" practiceType="medical" canEdit namaf={{ ...ready, discipline: '010', chosen: true }} disciplines={disciplines} onChanged={onChanged} />);
    expect(screen.getByLabelText('NAMAF benchmark list')).toHaveTextContent('Anaesthetist (010)');
    expect(screen.getByLabelText('NAMAF benchmark list')).toHaveTextContent('(chosen for this practice)');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith('p1', null));
  });

  it("leaves a 'general' practice to the Settings prompt: no list until the type is chosen", () => {
    const { container } = render(
      <NamafListNote practiceId="p1" practiceType="general" canEdit namaf={{ status: 'none', discipline: null, chosen: false, typeDiscipline: null, tariffs: [] }} disciplines={disciplines} onChanged={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says the list is not set up yet before the database change', () => {
    render(<NamafListNote practiceId="p1" practiceType="medical" canEdit namaf={{ status: 'not-set-up', discipline: '014', chosen: false, typeDiscipline: '014', tariffs: [] }} disciplines={[]} onChanged={vi.fn()} />);
    expect(screen.getByLabelText('NAMAF benchmark list')).toHaveTextContent('not set up yet');
  });

  // The way back names the practice type's list as the database links it, also for a type the app has never heard of
  it("names the list of a practice type that only the database knows as the one to go back to", () => {
    render(
      <NamafListNote practiceId="p1" practiceType="chiropractic" canEdit namaf={{ ...ready, discipline: '014', chosen: true, typeDiscipline: '004' }} disciplines={disciplines} onChanged={vi.fn()} />
    );
    expect(screen.getByRole('combobox').querySelector('option[value=""]')).toHaveTextContent("The practice type's: Chiropractor (004)");
  });

  it('says a practice type with no list of its own (aesthetic) bills from none until an administrator chooses one', () => {
    render(
      <NamafListNote practiceId="p1" practiceType="aesthetic" canEdit namaf={{ status: 'none', discipline: null, chosen: false, typeDiscipline: null, tariffs: [] }} disciplines={disciplines} onChanged={vi.fn()} />
    );
    expect(screen.getByLabelText('NAMAF benchmark list')).toHaveTextContent('has no NAMAF list of its own');
    expect(screen.getByRole('combobox')).toHaveDisplayValue('None (the practice type has no list)');
  });
});
