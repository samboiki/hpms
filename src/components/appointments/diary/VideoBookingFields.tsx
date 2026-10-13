import React, { useId } from 'react';
import { Icon } from '@iconify/react';
import { createTelemedicineRoomUrl } from '../../telemedicine/telemedicineLinks';
import { VIDEO_NOT_SET_UP_MESSAGE } from '../../../services/videoBookingService';

interface VideoBookingFieldsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** The room link as typed */
  link: string;
  onLinkChange: (link: string) => void;
  /** The practice's default room link (Diary settings), offered with one tap */
  practiceDefault: string | null;
  /** The practice, for a new private room's name */
  practiceId: string | null;
  /** The link's problem, in plain words */
  error?: string | null;
  /** visits has no video_link column yet: the booking is saved without the link */
  notSetUp?: boolean;
}

const INPUT_CLASS =
  'px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors';
const SMALL_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

/**
 * "Video consultation" in the booking form (parity B16): the booking keeps the link of the room the patient joins
 * (src/utils/diary/videoBookings.ts): the practice's own link (Diary settings), one typed, or a new private room.
 * Messages carry it as {{videoLink}}.
 */
export const VideoBookingFields: React.FC<VideoBookingFieldsProps> = ({
  enabled,
  onEnabledChange,
  link,
  onLinkChange,
  practiceDefault,
  practiceId,
  error,
  notSetUp = false
}) => {
  const id = useId();
  const newRoom = () => {
    try {
      onLinkChange(createTelemedicineRoomUrl(practiceId));
    } catch (roomError) {
      console.error('Could not create a private video room:', roomError);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            onEnabledChange(event.target.checked);
            // The practice's own room is the usual one: offered at once
            if (event.target.checked && !link.trim() && practiceDefault) onLinkChange(practiceDefault);
          }}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <Icon icon="solar:videocamera-record-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
        Video consultation
      </label>

      {enabled && (
        <div className="mt-3 space-y-2">
          <label htmlFor={`${id}-link`} className="block text-sm text-gray-700">
            Link the patient joins with
          </label>
          <input
            id={`${id}-link`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={link}
            onChange={(event) => onLinkChange(event.target.value)}
            placeholder="https://..."
            aria-invalid={!!error}
            aria-describedby={`${id}-help`}
            className={`${INPUT_CLASS} w-full min-w-0 font-mono text-xs`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={newRoom} className={SMALL_BUTTON_CLASS}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              New private room
            </button>
            {practiceDefault && link.trim() !== practiceDefault && (
              <button type="button" onClick={() => onLinkChange(practiceDefault)} className={SMALL_BUTTON_CLASS}>
                <Icon icon="solar:link-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Use the practice's link
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <p id={`${id}-help`} className="text-xs text-gray-500">
            The booking and its diary card keep this link. Reminders and messages can include it with {'{{videoLink}}'}.
          </p>
          {notSetUp && <p className="text-xs text-amber-700">{VIDEO_NOT_SET_UP_MESSAGE}</p>}
        </div>
      )}
    </div>
  );
};

export default VideoBookingFields;
