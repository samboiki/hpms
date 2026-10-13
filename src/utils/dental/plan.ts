/**
 * The treatment plan: planned work grouped into the visits it is planned for (visit 1, 2, 3 ...) and ordered within
 * each visit. Visit numbers are kept as they were planned (when visit 1 is done the plan continues with visit 2), so
 * moving an item never renumbers the other visits; only the order within a visit is rewritten.
 */
import type { PlanItem } from './chart';

export interface PlanVisit {
  visit: number;
  /** Work still to do in this visit, in order */
  items: PlanItem[];
}

/** One plan item's place, as dental_plan_arrange stores it. */
export interface PlanPlace {
  id: string;
  planVisit: number;
  planOrder: number;
}

const visitOf = (item: PlanItem): number => item.entry.planVisit ?? 1;

/** Work still to do, grouped by planned visit (lowest first) and in order within each visit. */
export function openPlanVisits(items: readonly PlanItem[]): PlanVisit[] {
  const open = items.filter(item => !item.done && item.entry.status === 'planned');
  const visits = new Map<number, PlanItem[]>();
  open.forEach(item => visits.set(visitOf(item), [...(visits.get(visitOf(item)) ?? []), item]));
  return [...visits.entries()]
    .sort(([a], [b]) => a - b)
    .map(([visit, list]) => ({
      visit,
      items: [...list].sort(
        (a, b) =>
          (a.entry.planOrder ?? Number.MAX_SAFE_INTEGER) - (b.entry.planOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.entry.recordedAt.localeCompare(b.entry.recordedAt) ||
          a.entry.id.localeCompare(b.entry.id)
      )
    }));
}

/** The visit a new planned item goes to: the first visit still planned, else visit 1. */
export const defaultPlanVisit = (visits: readonly PlanVisit[]): number => visits[0]?.visit ?? 1;

/** The number for a new visit: one after the last planned visit. */
export const nextPlanVisit = (visits: readonly PlanVisit[]): number => (visits.length > 0 ? Math.max(...visits.map(visit => visit.visit)) + 1 : 1);

/** Every item's place as the screen shows it: its visit and its position (1, 2, 3 ...) within the visit. */
export function placesOf(visits: readonly PlanVisit[]): PlanPlace[] {
  return visits.flatMap(visit => visit.items.map((item, index) => ({ id: item.entry.id, planVisit: visit.visit, planOrder: index + 1 })));
}

/** Every item's place as stored now (before a move). */
export function storedPlaces(visits: readonly PlanVisit[]): PlanPlace[] {
  return visits.flatMap(visit => visit.items.map(item => ({ id: item.entry.id, planVisit: visitOf(item), planOrder: item.entry.planOrder ?? 0 })));
}

/** Moves an item one place up (-1) or down (+1) within its visit; unchanged at either end. */
export function moveWithinVisit(visits: readonly PlanVisit[], itemId: string, step: -1 | 1): PlanVisit[] {
  return visits.map(visit => {
    const index = visit.items.findIndex(item => item.entry.id === itemId);
    const target = index + step;
    if (index < 0 || target < 0 || target >= visit.items.length) return visit;
    const items = [...visit.items];
    [items[index], items[target]] = [items[target], items[index]];
    return { ...visit, items };
  });
}

/** Moves an item to the end of another visit (a new visit number makes a new visit); an emptied visit disappears. */
export function moveToVisit(visits: readonly PlanVisit[], itemId: string, visitNumber: number): PlanVisit[] {
  const item = visits.flatMap(visit => visit.items).find(candidate => candidate.entry.id === itemId);
  if (!item || !Number.isInteger(visitNumber) || visitNumber < 1) return [...visits];
  const without = visits.map(visit => ({ ...visit, items: visit.items.filter(candidate => candidate.entry.id !== itemId) }));
  const target = without.find(visit => visit.visit === visitNumber);
  const moved = target
    ? without.map(visit => (visit.visit === visitNumber ? { ...visit, items: [...visit.items, item] } : visit))
    : [...without, { visit: visitNumber, items: [item] }];
  return moved.filter(visit => visit.items.length > 0).sort((a, b) => a.visit - b.visit);
}

/** The places that differ between two arrangements: what dental_plan_arrange needs to store. */
export function changedPlaces(before: readonly PlanPlace[], after: readonly PlanPlace[]): PlanPlace[] {
  const old = new Map(before.map(place => [place.id, place]));
  return after.filter(place => {
    const previous = old.get(place.id);
    return !previous || previous.planVisit !== place.planVisit || previous.planOrder !== place.planOrder;
  });
}
