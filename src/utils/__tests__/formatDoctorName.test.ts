import { describe, it, expect } from 'vitest';
import { formatDoctorName } from '../formatDoctorName';

// Doctor names are stored inconsistently ("Dr. Jane Doe" vs "Jane Doe").
// Patients and staff must always see exactly one title, never "Dr. Dr.".
describe('formatDoctorName', () => {
  it('does not double the title when the stored name already has it', () => {
    expect(formatDoctorName('Dr. Hilma Amalwa')).toBe('Dr. Hilma Amalwa');
  });

  it('adds the title when the stored name lacks it', () => {
    expect(formatDoctorName('Hilma Amalwa')).toBe('Dr. Hilma Amalwa');
  });

  it('collapses an already-doubled title from bad data', () => {
    expect(formatDoctorName('Dr. Dr. Hilma Amalwa')).toBe('Dr. Hilma Amalwa');
    expect(formatDoctorName('dr Hilma Amalwa')).toBe('Dr. Hilma Amalwa');
  });

  it('shows a fallback instead of a bare "Dr." when no name is known', () => {
    expect(formatDoctorName(null)).toBe('Not assigned');
    expect(formatDoctorName('  ', 'Unassigned')).toBe('Unassigned');
    expect(formatDoctorName('Dr.')).toBe('Not assigned');
  });
});
