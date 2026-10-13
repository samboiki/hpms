import { describe, it, expect } from 'vitest';
import type { ChartEntry, PlanItem } from '../chart';
import { changedPlaces, defaultPlanVisit, moveToVisit, moveWithinVisit, nextPlanVisit, openPlanVisits, placesOf, storedPlaces } from '../plan';

const item = (id: string, planVisit: number, planOrder: number, overrides: Partial<PlanItem> = {}): PlanItem => {
  const entry: ChartEntry = {
    id,
    tooth: '36',
    surfaces: null,
    work: 'filling',
    status: 'planned',
    tariffCode: '8369',
    planVisit,
    planOrder,
    quoteId: null,
    visitId: null,
    invoiceId: null,
    note: null,
    recordedBy: null,
    recordedAt: '2026-10-01T10:00:00Z',
    statusChangedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null
  };
  return { entry, done: false, billedBy: null, doneDate: null, quote: null, ...overrides };
};

const ids = (visits: ReturnType<typeof openPlanVisits>) => visits.map(visit => `${visit.visit}: ${visit.items.map(plan => plan.entry.id).join(' ')}`);

// Business rule: a plan is the work still to do, grouped into the visits it is planned for, in the order the
// practitioner wants; done work leaves the plan.
describe('plan visits', () => {
  it('groups open work by visit and order, leaving done work out', () => {
    const visits = openPlanVisits([item('c', 2, 1), item('b', 1, 2), item('a', 1, 1), item('done', 1, 3, { done: true })]);
    expect(ids(visits)).toEqual(['1: a b', '2: c']);
    expect(defaultPlanVisit(visits)).toBe(1);
    expect(nextPlanVisit(visits)).toBe(3);
  });

  it('starts an empty plan at visit 1', () => {
    expect(defaultPlanVisit([])).toBe(1);
    expect(nextPlanVisit([])).toBe(1);
  });
});

// Business rule: moving work never renumbers other visits (visit 2 stays visit 2 on the quote and in the diary);
// only the order inside a visit is rewritten, and only changed places are saved.
describe('arranging the plan', () => {
  const visits = openPlanVisits([item('a', 1, 1), item('b', 1, 2), item('c', 2, 1)]);

  it('moves work up and down within its visit', () => {
    expect(ids(moveWithinVisit(visits, 'b', -1))).toEqual(['1: b a', '2: c']);
    expect(ids(moveWithinVisit(visits, 'a', -1))).toEqual(['1: a b', '2: c']);
  });

  it('moves work to the end of another visit or to a new one; an emptied visit disappears', () => {
    expect(ids(moveToVisit(visits, 'a', 2))).toEqual(['1: b', '2: c a']);
    expect(ids(moveToVisit(visits, 'c', 3))).toEqual(['1: a b', '3: c']);
    expect(ids(moveToVisit(moveToVisit(visits, 'c', 1), 'c', 1))).toEqual(['1: a b c']);
  });

  it('saves only the places that changed', () => {
    const moved = moveWithinVisit(visits, 'b', -1);
    expect(changedPlaces(storedPlaces(visits), placesOf(moved))).toEqual([
      { id: 'b', planVisit: 1, planOrder: 1 },
      { id: 'a', planVisit: 1, planOrder: 2 }
    ]);
    expect(changedPlaces(storedPlaces(visits), placesOf(visits))).toEqual([]);
  });
});
