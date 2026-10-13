import React from 'react';
import { Icon } from '@iconify/react';
import { diaryBlockDayLabel, type DiaryBlock } from '../../../utils/diary/blockedTime';
import type { DiaryHoliday } from '../../../utils/diary/holidays';

interface DiaryDayNoticesProps {
  holiday: DiaryHoliday | null;
  /** Blocks on the day shown (already filtered to that day) */
  blocks: DiaryBlock[];
  practitionerName: (id: string) => string | null;
  /** Opens "Block time" to add or remove blocks */
  onManage?: () => void;
}

/** What reception must know about the day before booking: a public holiday and any blocked time. */
export const DiaryDayNotices: React.FC<DiaryDayNoticesProps> = ({ holiday, blocks, practitionerName, onManage }) => {
  if (!holiday && blocks.length === 0) return null;
  return (
    <div className="px-3 md:px-4 pt-3 space-y-2">
      {holiday && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Icon icon="solar:flag-bold-duotone" className="mt-0.5 h-4 w-4 flex-none text-amber-600" aria-hidden="true" />
          <p className="min-w-0 break-words">
            <span className="font-semibold">{holiday.name}</span>: public holiday. Bookings on this day ask for confirmation.
          </p>
        </div>
      )}
      {blocks.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Icon icon="solar:forbidden-circle-bold-duotone" className="h-4 w-4 flex-none text-gray-500" aria-hidden="true" />
              Blocked time
            </p>
            {onManage && (
              <button
                type="button"
                onClick={onManage}
                className="rounded-md px-2 py-1 text-xs font-semibold text-[#0196be] hover:bg-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01b9d5]"
              >
                Manage
              </button>
            )}
          </div>
          <ul className="mt-1 space-y-0.5">
            {blocks.map((block) => (
              <li key={block.id} className="text-sm text-gray-600 break-words">
                {diaryBlockDayLabel(block, block.doctorId ? practitionerName(block.doctorId) : null)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DiaryDayNotices;
