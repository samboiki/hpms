import React from 'react';
import { Icon } from '@iconify/react';
import { shortVideoLink, storedVideoLink } from '../../../utils/diary/videoBookings';

interface VideoBookingIconProps {
  /** The booking's room link (visits.video_link); nothing shows for a booking seen in the rooms */
  link: string | null | undefined;
  /** Show "Video" next to the icon (cards with room for it) */
  showLabel?: boolean;
  className?: string;
}

/**
 * A video consultation on a diary card (parity B16), in the same small framed style as the reminder icon beside it.
 * The link is the tooltip and the accessible name.
 */
export const VideoBookingIcon: React.FC<VideoBookingIconProps> = ({ link, showLabel = false, className = '' }) => {
  const stored = storedVideoLink(link);
  if (!stored) return null;
  const detail = `Video consultation: ${shortVideoLink(stored)}`;
  return (
    <span
      role="img"
      aria-label={detail}
      title={detail}
      className={`inline-flex flex-none items-center gap-1 rounded-lg bg-purple-50 text-purple-700 ring-1 ring-purple-200 ${showLabel ? 'px-2 py-1' : 'p-0.5'} ${className}`}
    >
      <Icon icon="solar:videocamera-record-bold-duotone" className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
      {showLabel && <span className="text-xs font-semibold whitespace-nowrap">Video</span>}
    </span>
  );
};

export default VideoBookingIcon;
