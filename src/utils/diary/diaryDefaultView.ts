/**
 * Whose bookings the diary opens on, and who a new booking starts with. The owner's rule: a doctor opens on their own
 * column, not on colleagues' columns; reception, administrators and everyone else who books for several practitioners
 * open on all of them. Each user can save their own default instead ("Open the diary on" in the practitioner filter,
 * "Remember as my default" in the booking form). It is kept on their staff row (users.diary_practitioner_ids,
 * proposals/2026-10-08-diary-default-practitioner.sql), so it follows them to any computer, and it wins over the role.
 *
 * A view is a list of practitioner ids; an empty list means all practitioners side by side.
 */

export type DiaryView = readonly string[];

export const ALL_PRACTITIONERS: DiaryView = [];

/** The view a role opens on when the user saved none */
export function roleDefaultView(role: string | null | undefined, userId: string | null | undefined): DiaryView {
  return role === 'doctor' && userId ? [userId] : ALL_PRACTITIONERS;
}

export interface DiaryViewInput {
  role: string | null | undefined;
  userId: string | null | undefined;
  /** The user's saved default: null = nothing saved, [] = all practitioners */
  saved: DiaryView | null | undefined;
  /** The practice's active staff, or null while not loaded (the saved ids are then kept as they are) */
  activeStaffIds: Iterable<string> | null;
}

/**
 * The view the diary opens on: the saved default, without anyone who has left the practice, else the role's. When
 * nobody saved is still active, the role default applies instead of an empty diary.
 */
export function resolveDiaryView(input: DiaryViewInput): DiaryView {
  if (input.saved) {
    if (input.saved.length === 0) return ALL_PRACTITIONERS;
    const active = input.activeStaffIds ? new Set(input.activeStaffIds) : null;
    const kept = [...new Set(input.saved)].filter((id) => !active || active.has(id));
    if (kept.length > 0) return kept;
  }
  return roleDefaultView(input.role, input.userId);
}

export interface FormPractitionerInput {
  /** The column, slot or copied booking the form was opened from */
  openedForId?: string | null;
  /** The user's view (resolveDiaryView); null while it is not known */
  view: DiaryView | null;
  /** The practitioners the form lists */
  optionIds: readonly string[];
}

/**
 * The practitioner a new booking starts with: the one the form was opened for, else the user's default when that is
 * one practitioner the form lists. Several or all practitioners: reception chooses (a guess would go unnoticed).
 */
export function bookingFormPractitioner(input: FormPractitionerInput): string | null {
  if (input.openedForId) return input.openedForId;
  const only = input.view && input.view.length === 1 ? input.view[0] : null;
  return only && input.optionIds.includes(only) ? only : null;
}

/**
 * A tick in the practitioner filter: "All practitioners" (id null) clears the choice; a practitioner is added or taken
 * away, and taking away the last one shows everyone again. Kept in column order, so columns never swap places.
 */
export function toggleDiaryView(view: DiaryView, id: string | null, columnOrder: readonly string[]): DiaryView {
  if (id === null) return ALL_PRACTITIONERS;
  const next = view.includes(id) ? view.filter((other) => other !== id) : [...view, id];
  const position = new Map(columnOrder.map((other, index) => [other, index]));
  const place = (other: string) => position.get(other) ?? columnOrder.length;
  return next.sort((a, b) => place(a) - place(b));
}

/** The same practitioners, in any order */
export function sameDiaryView(a: DiaryView, b: DiaryView): boolean {
  const first = new Set(a);
  const second = new Set(b);
  return first.size === second.size && [...first].every((id) => second.has(id));
}

/** "all practitioners", "Dr One", "Dr One and Nurse One", "3 practitioners" */
export function describeDiaryView(view: DiaryView, nameOf: (id: string) => string): string {
  if (view.length === 0) return 'all practitioners';
  if (view.length === 1) return nameOf(view[0]);
  if (view.length === 2) return `${nameOf(view[0])} and ${nameOf(view[1])}`;
  return `${view.length} practitioners`;
}

/**
 * users.diary_practitioner_ids as read: null when nothing is saved. An empty list is a choice ("all practitioners"),
 * so a list whose entries are all unreadable counts as nothing saved, never as all.
 */
export function savedDiaryView(raw: unknown): DiaryView | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (raw.length > 0 && ids.length === 0) return null;
  return [...new Set(ids)];
}
