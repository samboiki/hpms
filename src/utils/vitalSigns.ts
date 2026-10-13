/**
 * Flags vital signs that need a clinician's attention, so every screen that shows vitals warns
 * on the same values with the same words.
 *
 * Only limits that hold for patients of any age are used: fever, low temperature, low oxygen and
 * high blood pressure. Pulse and breathing rate are left to the screens because their normal
 * range depends on the patient's age (a pulse of 120 is normal for a toddler).
 *
 * Values that are empty, unreadable or zero count as "not recorded": blank form fields are often
 * saved as 0, and flagging those as hypothermia would teach staff to ignore the warnings.
 */

export type VitalStatus = 'normal' | 'high' | 'low';

export interface VitalCheck {
  status: VitalStatus;
  /** Plain-language reason for the flag (for a badge or tooltip); null when nothing is flagged. */
  message: string | null;
}

export const VITAL_LIMITS = {
  feverCelsius: 38.0,
  lowTemperatureCelsius: 35.0,
  lowOxygenPercent: 94,
  highSystolic: 140,
  highDiastolic: 90,
} as const;

const NOT_FLAGGED: VitalCheck = { status: 'normal', message: null };

const toReading = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const reading = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(reading) && reading > 0 ? reading : null;
};

/** Temperature in °C. */
export function checkTemperature(celsius: number | string | null | undefined): VitalCheck {
  const reading = toReading(celsius);
  if (reading === null) return NOT_FLAGGED;
  if (reading >= VITAL_LIMITS.feverCelsius) {
    return { status: 'high', message: `Fever: ${VITAL_LIMITS.feverCelsius.toFixed(1)} °C or higher` };
  }
  if (reading < VITAL_LIMITS.lowTemperatureCelsius) {
    return { status: 'low', message: `Low temperature: below ${VITAL_LIMITS.lowTemperatureCelsius.toFixed(1)} °C` };
  }
  return NOT_FLAGGED;
}

/** Oxygen saturation (SpO2) in %. */
export function checkOxygenSaturation(percent: number | string | null | undefined): VitalCheck {
  const reading = toReading(percent);
  if (reading === null) return NOT_FLAGGED;
  if (reading < VITAL_LIMITS.lowOxygenPercent) {
    return { status: 'low', message: `Low oxygen: below ${VITAL_LIMITS.lowOxygenPercent}%` };
  }
  return NOT_FLAGGED;
}

/** Reads "120/80", "120 / 80" or "120/80 mmHg"; null when the reading has no systolic/diastolic pair. */
export function parseBloodPressure(
  reading: string | null | undefined
): { systolic: number; diastolic: number } | null {
  if (!reading) return null;
  const match = String(reading).match(/(\d{2,3}(?:\.\d+)?)\s*\/\s*(\d{2,3}(?:\.\d+)?)/);
  if (!match) return null;
  return { systolic: parseFloat(match[1]), diastolic: parseFloat(match[2]) };
}

/** Blood pressure written as "systolic/diastolic" in mmHg. */
export function checkBloodPressure(reading: string | null | undefined): VitalCheck {
  const pressure = parseBloodPressure(reading);
  if (!pressure) return NOT_FLAGGED;
  if (pressure.systolic >= VITAL_LIMITS.highSystolic || pressure.diastolic >= VITAL_LIMITS.highDiastolic) {
    return {
      status: 'high',
      message: `High blood pressure: ${VITAL_LIMITS.highSystolic}/${VITAL_LIMITS.highDiastolic} or higher`,
    };
  }
  return NOT_FLAGGED;
}
