import React, { useEffect, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { loadPracticeVideoLink, savePracticeVideoLink } from '../../../services/videoBookingService';
import { shortVideoLink } from '../../../utils/diary/videoBookings';
import { createTelemedicineRoomUrl } from '../../telemedicine/telemedicineLinks';
import { ReadOnlyNote, SettingsErrors } from './DiarySettingsParts';
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_CLASS, SECONDARY_CLASS } from './diarySettingsStyles';

interface VideoLinkSettingsSectionProps {
  practiceId: string;
  /** Practice administrators change the link (practice_settings' own policies); everyone else reads it */
  isAdmin: boolean;
}

/**
 * Diary settings > Appointment types > Video consultations (parity B16): the practice's own room link, offered for
 * every video booking (the booking form fills it in; reception can still type another link or make a private room).
 */
export const VideoLinkSettingsSection: React.FC<VideoLinkSettingsSectionProps> = ({ practiceId, isAdmin }) => {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPracticeVideoLink(practiceId).then((link) => {
      if (cancelled) return;
      setSaved(link);
      setDraft(link ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (saved === undefined) return <p className="text-sm text-gray-500" role="status">Loading...</p>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = await savePracticeVideoLink(practiceId, draft);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    setSaved(result.link);
    setDraft(result.link ?? '');
    toast.success(result.link ? 'Video link saved' : 'Video link removed');
  };

  return (
    <section className="space-y-4" aria-labelledby="video-link-heading">
      <h3 id="video-link-heading" className="text-sm font-semibold text-gray-900">Video consultations</h3>
      <p className="text-sm text-gray-600">
        The practice's own video room, for example a practitioner's Zoom, Teams or Meet link. A booking marked "Video
        consultation" starts with it; reception can still type another link or make a new private room for one booking.
      </p>
      {!isAdmin && (
        <ReadOnlyNote>
          {saved ? `The practice's link: ${shortVideoLink(saved, 60)}. ` : 'The practice has no video link of its own yet. '}
          Only a practice administrator can change it.
        </ReadOnlyNote>
      )}
      {isAdmin && (
        <form onSubmit={(event) => void save(event)} noValidate className="space-y-3">
          <div>
            <label htmlFor="practice-video-link" className={LABEL_CLASS}>
              The practice's room link
            </label>
            <input
              id="practice-video-link"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="https://..."
              className={`${INPUT_CLASS} font-mono text-xs`}
              aria-describedby="practice-video-link-help"
            />
            <p id="practice-video-link-help" className="mt-1 text-xs text-gray-500">
              Leave it empty for none. Anyone with the link can join the room: share it only with patients.
            </p>
          </div>
          <SettingsErrors errors={errors} />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  setDraft(createTelemedicineRoomUrl(practiceId));
                } catch (error) {
                  setErrors([error instanceof Error ? plainWords(error.message) : 'Could not make a room.']);
                }
              }}
              className={SECONDARY_CLASS}
            >
              <Icon icon="solar:videocamera-record-bold-duotone" className="h-5 w-5" aria-hidden="true" />
              Make a OneHealth room
            </button>
            <button type="submit" disabled={saving || draft.trim() === (saved ?? '')} className={PRIMARY_CLASS}>
              <Icon
                icon={saving ? 'solar:refresh-bold-duotone' : 'solar:check-circle-bold-duotone'}
                className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
              {saving ? 'Saving...' : 'Save link'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export default VideoLinkSettingsSection;
