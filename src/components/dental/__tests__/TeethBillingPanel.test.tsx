import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ServiceSelection } from '../../../types/billing';
import TeethBillingPanel from '../TeethBillingPanel';
import ToothPickerDialog from '../ToothPickerDialog';
import { dentalTariffs } from '../../quotes/__tests__/quoteTestTariffs';
import { loadBilledToothLines, loadChart, loadPatientBirthDate, loadQuoteRefs } from '../../../services/dental/dentalChartService';

// Nothing here reaches the database: the chart loads an empty history for an adult patient
vi.mock('../../../services/dental/dentalChartService', () => ({
  loadBilledToothLines: vi.fn(async () => ({ lines: [], unplaced: 0 })),
  loadChart: vi.fn(async () => ({ status: 'not_set_up' })),
  loadQuoteRefs: vi.fn(async () => []),
  loadPatientBirthDate: vi.fn(async () => '1990-05-01')
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const tariffs = dentalTariffs();
const filling = tariffs.find(row => row.code === '8367');

const renderPanel = (practiceType: string, onApply = vi.fn(), lines: ServiceSelection[] = []) =>
  render(
    <TeethBillingPanel
      practiceId="practice-1"
      practiceType={practiceType}
      patientId="patient-1"
      tariffs={tariffs}
      lines={lines}
      usage={{ '8367': 10 }}
      hasMedicalAid
      infectionControlStaff={1}
      disabledReason={null}
      onApply={onApply}
    />
  );

// A tooth on the chart (the chosen-teeth chips under it are named after their tooth too)
const tooth = (number: string) => within(screen.getByRole('group', { name: /^Tooth chart/ })).getByRole('button', { name: new RegExp(`^Tooth ${number},`) });
const billed = (lines: ServiceSelection[]) => lines.map(line => `${line.code}${line.teethNumbers?.length ? ` ${line.teethNumbers.join(',')}` : ''}`);

// Business rule: many practices are dental, and they bill by tooth. On the visit's Billing tab a dental practice sees
// the tooth chart and bills from it; a GP, specialist or optometry practice never sees teeth (isDentalPractice decides)
// and keeps its service list.
describe('the tooth chart on the visit Billing tab', () => {
  beforeEach(() => vi.mocked(loadBilledToothLines).mockClear());

  it('is shown in a dental practice, with every adult tooth', async () => {
    renderPanel('dental');
    expect(screen.getByRole('group', { name: 'Tooth chart, adult teeth' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Tooth \d\d,/ })).toHaveLength(32);
    await waitFor(() => expect(loadBilledToothLines).toHaveBeenCalledWith('patient-1'));
  });

  it('is not shown in a GP practice, which reads no dental history at all', async () => {
    const { container } = renderPanel('general');
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('group', { name: /Tooth chart/ })).toBeNull();
    await Promise.resolve();
    expect(loadBilledToothLines).not.toHaveBeenCalled();
  });

  it('bills a code for two chosen teeth as one line per tooth', async () => {
    const onApply = vi.fn();
    renderPanel('dental', onApply);
    fireEvent.click(tooth('36'));
    fireEvent.click(tooth('37'));
    expect(tooth('36')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Add 8367 .* for teeth 36 and 37/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(billed(onApply.mock.calls[0][0])).toEqual(['8109', '8367 36', '8346 36', '8367 37', '8346 37']);
  });

  it('offers the codes for the chosen teeth only once a tooth is chosen, tooth codes first', () => {
    renderPanel('dental');
    expect(screen.queryByRole('button', { name: /^Add 8367/ })).toBeNull();
    fireEvent.click(tooth('46'));
    const headings = screen.getAllByRole('heading', { level: 5 }).map(heading => heading.textContent);
    expect(headings[0]).toMatch(/^For tooth 46/);
    expect(headings[1]).toMatch(/^Without a tooth/);
    // Taking the only tooth off hides the codes again
    fireEvent.click(screen.getByRole('button', { name: /^Tooth 46, .*take it off$/ }));
    expect(screen.queryByRole('button', { name: /^Add 8367/ })).toBeNull();
  });
});

// Business rule: the visit screen closes on Escape, unsaved lines and all. Escape in the code search clears the search
// and nothing else.
it('clears the code search on Escape without closing the visit', () => {
  const visitScreen = vi.fn();
  document.addEventListener('keydown', visitScreen, true);
  renderPanel('dental');
  fireEvent.click(tooth('36'));
  const search = screen.getByRole('searchbox', { name: 'Find a code for these teeth' });
  fireEvent.change(search, { target: { value: 'resin' } });
  search.focus();
  fireEvent.keyDown(search, { key: 'Escape' });
  document.removeEventListener('keydown', visitScreen, true);
  expect(search).toHaveValue('');
  expect(visitScreen).not.toHaveBeenCalled();
});

// Business rule: a fund refuses a line for a tooth item without its tooth. A line saved before its code's tooth flag was
// corrected can still be on a visit; the Billing tab says so before the invoice goes out.
it('points out a line on the visit that needs a tooth and has none', () => {
  const oldLine: ServiceSelection = { id: 'old', tariffId: 't', code: '8367', description: 'Resin', category: 'Service', unitPrice: 448.7, quantity: 1, totalPrice: 448.7 };
  const withTooth: ServiceSelection = { ...oldLine, id: 'ok', teethNumbers: ['16'] };
  renderPanel('dental', vi.fn(), [oldLine, withTooth]);
  expect(screen.getByText(/^8367 needs a tooth and has none on this visit/)).toBeInTheDocument();
});

// Business rule: a code picked from the service list that needs a tooth cannot be billed without one; the picker
// offers milk teeth for children and several teeth at once.
describe('the tooth picker for a code from the service list', () => {
  const renderPicker = (onApply = vi.fn()) =>
    render(
      <ToothPickerDialog
        open
        tariff={filling ?? null}
        quantity={1}
        practiceId="practice-1"
        patientId="patient-1"
        lines={[]}
        tariffs={tariffs}
        hasMedicalAid
        autoInfectionControl
        infectionControlStaff={1}
        disabledReason={null}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );

  it('cannot add the code until a tooth is chosen', () => {
    const onApply = vi.fn();
    renderPicker(onApply);
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(tooth('16'));
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('bills milk teeth, several at once', async () => {
    const onApply = vi.fn();
    renderPicker(onApply);
    await waitFor(() => expect(loadPatientBirthDate).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Child' }));
    fireEvent.click(tooth('54'));
    fireEvent.click(tooth('64'));
    fireEvent.click(screen.getByRole('button', { name: 'Add for 2 teeth' }));
    expect(billed(onApply.mock.calls[0][0])).toEqual(['8109', '8367 54', '8346 54', '8367 64', '8346 64']);
    expect(loadChart).toHaveBeenCalledWith('patient-1');
    expect(loadQuoteRefs).toHaveBeenCalledWith('practice-1', 'patient-1');
  });
});

// Business rule (parity D5): the fund pays a filling by its number of surfaces and reads the tooth and surfaces from the
// claim. With one tooth chosen the surfaces are tapped on the chart; the filling line keeps them, and a code for
// another number of surfaces is refused at once with the code that fits. Before the database keeps surfaces, the
// panel does not offer them (a setting that does nothing is not shown).
describe('surfaces of a filling on the chart', () => {
  const renderWithSurfaces = (onApply = vi.fn()) =>
    render(
      <TeethBillingPanel
        practiceId="practice-1"
        practiceType="dental"
        patientId="patient-1"
        tariffs={tariffs}
        lines={[]}
        usage={{ '8367': 10 }}
        hasMedicalAid
        infectionControlStaff={1}
        disabledReason={null}
        onApply={onApply}
        canRecordSurfaces
      />
    );

  it('keeps the surface tapped on the filling line', () => {
    const onApply = vi.fn();
    renderWithSurfaces(onApply);
    fireEvent.click(tooth('36'));
    fireEvent.click(screen.getByRole('button', { name: /^M: mesial/ }));
    expect(screen.getByRole('button', { name: /^Add 8367 .*fits the surfaces marked/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Add 8367/ }));
    const filling = (onApply.mock.calls[0][0] as ServiceSelection[]).find(line => line.code === '8367');
    expect(filling).toMatchObject({ teethNumbers: ['36'], toothSurfaces: 'M' });
  });

  it('refuses the one-surface code for two surfaces, naming the code for two', async () => {
    const { toast } = await import('react-hot-toast');
    const onApply = vi.fn();
    renderWithSurfaces(onApply);
    fireEvent.click(tooth('36'));
    fireEvent.click(screen.getByRole('button', { name: /^M: mesial/ }));
    fireEvent.click(screen.getByRole('button', { name: /^O: occlusal/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Add 8367 .*for 1 surface, not the surfaces marked/ }));
    expect(onApply).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^8367 is for 1 surface, but 2 are marked \(M O\)\. Use 8368/), expect.anything());
  });

  it('is not offered before the database keeps surfaces, nor for several teeth', async () => {
    renderPanel('dental');
    fireEvent.click(tooth('36'));
    expect(screen.queryByRole('button', { name: /^M: mesial/ })).toBeNull();
    cleanup();
    renderWithSurfaces();
    fireEvent.click(tooth('36'));
    fireEvent.click(tooth('37'));
    expect(screen.queryByRole('button', { name: /^M: mesial/ })).toBeNull();
    await waitFor(() => expect(loadBilledToothLines).toHaveBeenCalled());
  });
});
