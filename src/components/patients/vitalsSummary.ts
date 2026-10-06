import { checkBloodPressure, checkOxygenSaturation, checkTemperature } from '../../utils/vitalSigns';

/** One reading in the patient Overview's "Latest vitals"; `warning` is set when it needs attention. */
export interface VitalReading {
  text: string;
  warning: string | null;
}

/** The vitals columns the Overview shows (rows are loaded with select *). */
export interface VitalsRow {
  blood_pressure?: string | null;
  pulse_rate?: number | string | null;
  temperature?: number | string | null;
  respiratory_rate?: number | string | null;
  oxygen_saturation?: number | string | null;
  weight?: number | string | null;
}

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim() !== '';

/**
 * The readings of one vitals row, in the order staff scan them. Blood pressure, temperature and
 * oxygen carry the shared warning text from utils/vitalSigns, so the summary never shows a fever
 * or low oxygen as a routine number. Pulse and breathing rate are not flagged: their safe range
 * depends on the patient's age.
 */
export function describeVitalReadings(vital: VitalsRow): VitalReading[] {
  const readings: VitalReading[] = [];
  if (hasValue(vital.blood_pressure)) {
    readings.push({ text: `BP ${vital.blood_pressure} mmHg`, warning: checkBloodPressure(vital.blood_pressure).message });
  }
  if (hasValue(vital.pulse_rate)) readings.push({ text: `Pulse ${vital.pulse_rate} bpm`, warning: null });
  if (hasValue(vital.temperature)) {
    readings.push({ text: `Temp ${vital.temperature} °C`, warning: checkTemperature(vital.temperature).message });
  }
  if (hasValue(vital.respiratory_rate)) readings.push({ text: `Resp ${vital.respiratory_rate} /min`, warning: null });
  if (hasValue(vital.oxygen_saturation)) {
    readings.push({ text: `SpO2 ${vital.oxygen_saturation}%`, warning: checkOxygenSaturation(vital.oxygen_saturation).message });
  }
  if (hasValue(vital.weight)) readings.push({ text: `Weight ${vital.weight} kg`, warning: null });
  return readings;
}
