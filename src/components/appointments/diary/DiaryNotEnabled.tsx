import React from 'react';
import { Icon } from '@iconify/react';

/** Shown instead of errors while the diary_blocks table is not in the database yet. */
export const DiaryNotEnabled: React.FC = () => (
  <div className="rounded-xl bg-gray-50 px-4 py-6 text-center">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
      <Icon icon="solar:forbidden-circle-bold-duotone" className="h-6 w-6 text-indigo-500" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-gray-900">Blocked time is not switched on yet</h3>
    <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
      Your administrator needs to apply the diary update first. Nothing is saved until then. Public holidays and
      double-booking checks already work.
    </p>
  </div>
);

export default DiaryNotEnabled;
