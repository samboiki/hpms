import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

/** Where an administrator chooses the practice type (Settings > Practice > Practice Profile > Practice type) */
export const PRACTICE_TYPE_SETTINGS_PATH = '/settings?tab=practice&section=profile#practice-type';

/**
 * Owner decision 13 Oct 2026: a practice whose type is 'general' (or not set) matches no price list. The price-list
 * screens say so and point to the one place the type is chosen. Same look as the amber notices on those screens.
 */
export const PracticeTypeNeededNotice: React.FC = () => (
  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">
    <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
    <span>
      The practice type is not chosen yet, so no price list matches this practice.{' '}
      <Link to={PRACTICE_TYPE_SETTINGS_PATH} className="font-medium underline">
        Choose the practice type in Settings
      </Link>
      .
    </span>
  </div>
);

export default PracticeTypeNeededNotice;
