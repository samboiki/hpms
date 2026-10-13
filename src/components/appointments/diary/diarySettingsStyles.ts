/**
 * The look of the Diary settings tabs (DiarySettingsModal.tsx, DiaryStatusesTab.tsx, AppointmentTypesSection.tsx), in
 * one place so every tab's fields and buttons match.
 */
export const FIELD_CLASS =
  'px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:cursor-not-allowed disabled:opacity-60';
export const INPUT_CLASS = `w-full ${FIELD_CLASS}`;
/** Time inputs and the branch list in the hours rows: their own width, so a day fits on one line */
export const TIME_CLASS = `w-32 ${FIELD_CLASS}`;
export const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';
export const CHECK_CLASS = 'h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500';
export const PRIMARY_CLASS =
  'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:from-purple-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2';
export const SECONDARY_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
/** The pen and bin beside a status or type in a list */
export const ICON_BUTTON_CLASS =
  'rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
