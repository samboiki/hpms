/**
 * Encounters' address: the tab, the analytics view and the period live in it (/encounters?tab=analytics&view=visits&
 * period=30d), so a screen opened from a figure can link straight back to the same figures, and so can the browser's
 * Back. The visits a figure opens in the encounters list travel with the browser's history entry (VisitFocus), so
 * coming back from a patient finds the same list.
 */
import { diaryDayParams, EVERYONE_ON_THE_DAY } from '../diary/diaryDayFocus';
import { DEFAULT_ANALYTICS_PERIOD, isAnalyticsPeriod, type AnalyticsPeriod } from './encounterAnalytics';

export const ENCOUNTERS_TABS = ['analytics', 'encounters', 'automations'] as const;
export type EncountersTab = (typeof ENCOUNTERS_TABS)[number];

export const ANALYTICS_VIEWS = ['visits', 'diagnoses'] as const;
export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];

export interface EncountersPlace {
  tab: EncountersTab;
  view: AnalyticsView;
  period: AnalyticsPeriod;
}

/** The sidebar's Encounters opens the list */
export const DEFAULT_ENCOUNTERS_PLACE: EncountersPlace = { tab: 'encounters', view: 'visits', period: DEFAULT_ANALYTICS_PERIOD };

const oneOf = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  values.find((item) => item === value) ?? fallback;

/** Where the address points; anything unknown falls back to the defaults. */
export function readEncountersPlace(params: URLSearchParams): EncountersPlace {
  const period = params.get('period');
  return {
    tab: oneOf(ENCOUNTERS_TABS, params.get('tab'), DEFAULT_ENCOUNTERS_PLACE.tab),
    view: oneOf(ANALYTICS_VIEWS, params.get('view'), DEFAULT_ENCOUNTERS_PLACE.view),
    period: isAnalyticsPeriod(period) ? period : DEFAULT_ENCOUNTERS_PLACE.period
  };
}

export const encountersParams = (place: EncountersPlace): URLSearchParams =>
  new URLSearchParams({ tab: place.tab, view: place.view, period: place.period });

export const encountersPath = (place: EncountersPlace): string => `/encounters?${encountersParams(place).toString()}`;

/**
 * The diary (on the dashboard) open at a day, offering the way back to `backTo`. The figure counted every
 * practitioner's bookings, so the day opens on all of them (a doctor's diary otherwise opens on their own column only).
 */
export const diaryDayLink = (dayKey: string, backTo: string): string => {
  const params = diaryDayParams(dayKey, EVERYONE_ON_THE_DAY);
  params.set('returnTo', backTo);
  return `/?${params.toString()}`;
};

/** A way back the diary may offer: only into Encounters, so a crafted link cannot send staff anywhere else. */
export function safeEncountersReturn(value: string | null | undefined): string | null {
  if (!value || !/^\/encounters(\?[A-Za-z0-9=&_%.-]*)?$/.test(value)) return null;
  return value;
}

/** The visits a figure on Analytics opened in the encounters list */
export interface VisitFocus {
  /** What they are, e.g. "No-shows, 13 Sep-12 Oct 2026" */
  label: string;
  visitIds: string[];
}

/** The focus kept with a history entry (location.state), or null when there is none or it is not one. */
export function readVisitFocus(state: unknown): VisitFocus | null {
  const focus = (state as { visitFocus?: unknown } | null)?.visitFocus as Partial<VisitFocus> | undefined;
  if (!focus || typeof focus.label !== 'string' || !Array.isArray(focus.visitIds)) return null;
  if (!focus.visitIds.every((id) => typeof id === 'string')) return null;
  return { label: focus.label, visitIds: focus.visitIds };
}
