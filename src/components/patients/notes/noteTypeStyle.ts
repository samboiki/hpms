import type { FollowUpState, NoteType } from './patientNotes';

/** How each kind of note looks wherever it is listed (the patient file and the dashboard's follow-ups). */
export const NOTE_TYPE_STYLE: Readonly<Record<NoteType, { icon: string; chip: string }>> = {
  clinical: { icon: 'solar:stethoscope-bold-duotone', chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  account: { icon: 'solar:wallet-money-bold-duotone', chip: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' },
  contact: { icon: 'solar:phone-calling-bold-duotone', chip: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  general: { icon: 'solar:notes-bold-duotone', chip: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200' }
};

/** A follow-up's line: red when late, amber on the day, quiet before, green once done. */
export const FOLLOW_UP_STYLE: Readonly<Record<Exclude<FollowUpState, 'none'>, string>> = {
  overdue: 'bg-red-50 text-red-800 ring-1 ring-red-200',
  today: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
  upcoming: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200',
  done: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
};
