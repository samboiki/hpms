/**
 * Parity O2: when a code with a recall is invoiced, staff are offered the patient's recall with the date filled from
 * the code's interval: one tap sets it, one tap skips it. It never repeats a recall the patient already has, never
 * asks twice for the same visit and code after a skip (on any computer: the database remembers the skip), and never
 * gets in the way when recalls, or the remembered skips, are not set up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NO_CODE_RULES } from '../../../utils/billing/codeRules';

const toasts = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }) }));
vi.mock('react-hot-toast', () => toasts);
const recalls = vi.hoisted(() => ({ loadForPatient: vi.fn(), loadPatients: vi.fn(), setRecall: vi.fn() }));
vi.mock('../../../services/patientRecallService', () => ({
  patientRecallService: recalls,
  isRecallsNotSetUpError: (error: unknown) => error instanceof Error && error.name === 'RecallsNotSetUpError'
}));
// The skips as the database keeps them: per visit, the codes whose offer was skipped (shared by every computer)
const skips = vi.hoisted(() => {
  const store = new Map<string, Set<string>>();
  return {
    store,
    loadSkippedRecallOffers: vi.fn(async (visitId: string) => new Set(store.get(visitId) ?? [])),
    skipRecallOffers: vi.fn(async (_practiceId: string, visitId: string, codes: string[]) => {
      store.set(visitId, new Set([...(store.get(visitId) ?? []), ...codes]));
      return true;
    })
  };
});
vi.mock('../../../services/recallOfferSkipService', () => ({
  loadSkippedRecallOffers: skips.loadSkippedRecallOffers,
  skipRecallOffers: skips.skipRecallOffers
}));

import { offerVisitRecalls } from '../recallOffer';

const TARIFFS = [
  { code: '8159', description: 'Scale and polish', code_rules: { ...NO_CODE_RULES, recallMonths: 6 } },
  { code: '8101', description: 'Examination', code_rules: null }
];
const INPUT = { practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1', visitDate: '2026-10-12', lines: [{ code: '8101' }, { code: '8159' }], tariffs: TARIFFS };

/** The offer as the toast shows it */
const showOffer = () => {
  const [renderOffer] = toasts.toast.custom.mock.calls[0] as [(toast: { visible: boolean }) => ReactElement];
  render(renderOffer({ visible: true }));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T08:00:00Z'));
  window.localStorage.clear();
  [toasts.toast, toasts.toast.error, toasts.toast.success, toasts.toast.custom, toasts.toast.dismiss].forEach(fn => fn.mockReset());
  recalls.loadForPatient.mockReset().mockResolvedValue([]);
  recalls.loadPatients.mockReset().mockResolvedValue(new Map([['patient-1', { id: 'patient-1', name: 'Anna Example', cellNumber: null }]]));
  recalls.setRecall.mockReset().mockResolvedValue('recall-1');
  skips.store.clear();
  skips.loadSkippedRecallOffers.mockClear();
  skips.skipRecallOffers.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('offerVisitRecalls', () => {
  it("offers the code's recall for the patient, and one tap sets it from this visit", async () => {
    await offerVisitRecalls(INPUT);
    showOffer();
    expect(screen.getByText('Set a recall for Anna Example?')).toBeInTheDocument();
    expect(screen.getByText(/Scale and polish on 12 Apr 2027 \(in 6 months, from code 8159\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Set recall' }));
    await waitFor(() =>
      expect(recalls.setRecall).toHaveBeenCalledWith({ practiceId: 'practice-1', patientId: 'patient-1', dueOn: '2027-04-12', reason: 'Scale and polish', visitId: 'visit-1' })
    );
    await waitFor(() => expect(toasts.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Recall set for 12 Apr 2027/), expect.anything()));
  });

  // Saving the same visit again, here or at reception's computer, must not ask again once staff said no
  it('skips with one tap and does not ask again for the same visit and code, on any computer', async () => {
    await offerVisitRecalls(INPUT);
    showOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(recalls.setRecall).not.toHaveBeenCalled();
    expect(toasts.toast.dismiss).toHaveBeenCalledWith('recall-offer-visit-1');
    await waitFor(() => expect(skips.skipRecallOffers).toHaveBeenCalledWith('practice-1', 'visit-1', ['8159']));

    // Another computer: nothing of this one's browser storage, only what the database remembers
    window.localStorage.clear();
    toasts.toast.custom.mockReset();
    await offerVisitRecalls(INPUT);
    expect(toasts.toast.custom).not.toHaveBeenCalled();
  });

  // The skip is for that visit and code only: another visit, or another code with a recall, is still offered
  it('still offers the recall of another visit, or of another code on the same visit', async () => {
    skips.store.set('visit-1', new Set(['8159']));
    await offerVisitRecalls({ ...INPUT, visitId: 'visit-2' });
    expect(toasts.toast.custom).toHaveBeenCalledTimes(1);

    const tariffs = [...TARIFFS, { code: '8155', description: 'Fluoride treatment', code_rules: { ...NO_CODE_RULES, recallMonths: 12 } }];
    toasts.toast.custom.mockReset();
    await offerVisitRecalls({ ...INPUT, tariffs, lines: [...INPUT.lines, { code: '8155' }] });
    showOffer();
    expect(screen.getByText(/Fluoride treatment on 12 Oct 2027/)).toBeInTheDocument();
    expect(screen.queryByText(/Scale and polish/)).not.toBeInTheDocument();
  });

  // Before the database keeps skips (or when they cannot be read) the offer works as before: it is only asked again
  it('still offers and skips when the skips cannot be read or kept', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    skips.loadSkippedRecallOffers.mockRejectedValueOnce(new Error('network down'));
    skips.skipRecallOffers.mockResolvedValueOnce(false);
    await offerVisitRecalls(INPUT);
    showOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(toasts.toast.dismiss).toHaveBeenCalledWith('recall-offer-visit-1');
    expect(toasts.toast.error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('The skipped recall offers could not be read:', expect.any(Error));
    warn.mockRestore();
  });

  it('says why when the recall cannot be set, and keeps the offer open', async () => {
    recalls.setRecall.mockRejectedValue(new Error('This patient already has 10 recalls to come: remove one first.'));
    await offerVisitRecalls(INPUT);
    showOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Set recall' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has 10 recalls');
    expect(toasts.toast.dismiss).not.toHaveBeenCalled();
  });

  it('offers nothing when the patient has that recall coming already, or no code has a recall', async () => {
    recalls.loadForPatient.mockResolvedValue([{ id: 'r1', patientId: 'patient-1', dueOn: '2027-04-12', reason: 'Scale and polish', visitId: null, createdAt: null, status: 'open', matchedVisitId: null, matchedOn: null }]);
    await offerVisitRecalls(INPUT);
    await offerVisitRecalls({ ...INPUT, lines: [{ code: '8101' }] });
    expect(toasts.toast.custom).not.toHaveBeenCalled();
  });

  // The invoice is saved either way: a database without recalls just means no offer
  it('stays quiet when recalls are not set up', async () => {
    const notSetUp = Object.assign(new Error('Recalls are not set up in this database yet.'), { name: 'RecallsNotSetUpError' });
    recalls.loadForPatient.mockRejectedValue(notSetUp);
    await expect(offerVisitRecalls(INPUT)).resolves.toBeUndefined();
    expect(toasts.toast.custom).not.toHaveBeenCalled();
  });
});
