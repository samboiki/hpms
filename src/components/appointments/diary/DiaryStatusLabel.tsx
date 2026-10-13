import React from 'react';
import { DIARY_STATUS_COLOUR_STYLES, type DiaryStatus } from '../../../utils/diary/diaryStatuses';

interface DiaryStatusLabelProps {
  status: DiaryStatus | null | undefined;
  /** 'xs' on the time-grid cards, 'sm' on the card list and in visit actions */
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * A practice's own status on a booking ("Waiting for X-ray"): a coloured dot and the words, so colour is never the
 * only signal. Nothing when the booking has no status at its current stage (diaryStatuses.ts shownDiaryStatus).
 */
export const DiaryStatusLabel: React.FC<DiaryStatusLabelProps> = ({ status, size = 'xs', className = '' }) => {
  if (!status) return null;
  const style = DIARY_STATUS_COLOUR_STYLES[status.colour];
  return (
    <span
      title={`Status: ${status.name}`}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full font-medium ring-1 ring-inset ${style.chip} ${
        size === 'xs' ? 'px-1.5 text-[10px] leading-4' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${style.dot}`} aria-hidden="true" />
      <span className="truncate">
        <span className="sr-only">Status: </span>
        {status.name}
      </span>
    </span>
  );
};

export default DiaryStatusLabel;
