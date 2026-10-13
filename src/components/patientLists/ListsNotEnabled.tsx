import React from 'react';
import { Icon } from '@iconify/react';

/** Shown instead of errors while the patient-list tables are not in the database yet. */
export const ListsNotEnabled: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={compact ? 'rounded-xl bg-gray-50 px-4 py-6 text-center' : 'mx-auto max-w-md px-4 py-16 text-center'}>
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
      <Icon icon="solar:magic-stick-3-bold-duotone" className="h-7 w-7 text-indigo-500" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-gray-900">Automation lists are not switched on yet</h3>
    <p className="mt-1 text-sm text-gray-500">
      Your administrator needs to apply the patient lists update first. Nothing is saved or sent until then.
    </p>
  </div>
);

export default ListsNotEnabled;
