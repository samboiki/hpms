import React from 'react';
import { Icon } from '@iconify/react';
import type { ProcessorHealth } from '../../../utils/automations/processorHealth';

/**
 * Whether the automation sender really runs, in plain words. Nothing in the database runs on a schedule by itself,
 * so when the sender has not run for a day the practice is told, instead of a screen that looks busy.
 */
export const ProcessorNotice: React.FC<{ health: ProcessorHealth }> = ({ health }) => {
  if (health.state === 'running' || health.state === 'idle') {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600" role="status">
        <span className={`h-2 w-2 shrink-0 rounded-full ${health.state === 'running' ? 'bg-emerald-500' : 'bg-gray-300'}`} aria-hidden="true" />
        {health.state === 'running' ? `Running: last check ${health.lastRun}.` : 'Nothing is switched on.'}
        <span className="text-gray-500">
          {health.lastProcessed ? `Last processed ${health.lastProcessed}.` : 'Nothing processed yet.'}
        </span>
      </p>
    );
  }

  const notSetUp = health.state === 'not_set_up';
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notSetUp ? 'border-gray-200 bg-white text-gray-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
      role="status"
    >
      <Icon
        icon={notSetUp ? 'solar:info-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
        className={`mt-0.5 h-5 w-5 shrink-0 ${notSetUp ? 'text-gray-400' : 'text-amber-600'}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-medium">{health.notice}</p>
        {health.state !== 'not_set_up' && (
          <p className="mt-0.5 text-amber-800">
            {health.lastProcessed ? `Last processed ${health.lastProcessed}.` : 'Nothing has been processed yet.'}
            {health.state === 'waiting' ? ` Last check ${health.lastRun}.` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProcessorNotice;
