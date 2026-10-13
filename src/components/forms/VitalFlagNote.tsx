import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { VitalCheck } from '../../utils/vitalSigns';

/**
 * The warning under a vitals input when the reading is outside the safe range (from the checks in
 * src/utils/vitalSigns.ts). An icon and words carry the warning, not colour alone, so it is not
 * missed by colour-blind staff or on a poor screen.
 */
const VitalFlagNote: React.FC<{ check: VitalCheck }> = ({ check }) =>
  check.message ? (
    <p role="status" className="mt-1 flex items-center gap-1 text-sm font-medium text-red-700">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {check.message}
    </p>
  ) : null;

export default VitalFlagNote;
