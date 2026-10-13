import { describe, it, expect } from 'vitest';
import { SURFACE_ORDER, formatSurfaces, normalizeSurfaces, surfaceLayout, surfacesForTooth } from '../surfaces';

// Business rule: a back tooth has a biting surface (O) and a cheek side (B); a front tooth a biting edge (I) and a lip
// side (F); the inside is palatal (P) up and lingual (L) down. Offering a surface a tooth does not have invites a wrong
// record.
describe('surfaces of a tooth', () => {
  it('offers the surfaces each tooth has', () => {
    expect(surfacesForTooth('36')).toEqual(['M', 'O', 'D', 'B', 'L']);
    expect(surfacesForTooth('16')).toEqual(['M', 'O', 'D', 'B', 'P']);
    expect(surfacesForTooth('11')).toEqual(['M', 'I', 'D', 'F', 'P']);
    expect(surfacesForTooth('83')).toEqual(['M', 'I', 'D', 'F', 'L']);
  });

  it('stores surfaces once each in one order, dropping those the tooth does not have', () => {
    expect(normalizeSurfaces('dom', '36')).toBe('MOD');
    expect(normalizeSurfaces(['D', 'M', 'M'], '36')).toBe('MD');
    expect(normalizeSurfaces('MOI', '36')).toBe('MO');
    expect(normalizeSurfaces('', '36')).toBe('');
    expect(formatSurfaces('MOD')).toBe('M O D');
  });

  // The database function dental_chart_surfaces orders letters by 'MOIDBFLP': the two must agree, or a saved filling
  // would come back with its surfaces in another order
  it('uses the same order as the database', () => {
    expect(SURFACE_ORDER.join('')).toBe('MOIDBFLP');
  });
});

// Business rule: on the chart the mesial side faces the middle of the arch and the outside faces out of the mouth.
// Drawn the other way, a mesial filling would show on the distal side.
describe('where surfaces are drawn', () => {
  it('draws an upper right tooth with its middle side to the right', () => {
    expect(surfaceLayout('16')).toEqual({ top: 'B', bottom: 'P', left: 'D', right: 'M', centre: 'O' });
  });

  it('draws a lower left tooth with its middle side to the left and its cheek side down', () => {
    expect(surfaceLayout('36')).toEqual({ top: 'L', bottom: 'B', left: 'M', right: 'D', centre: 'O' });
  });

  it('draws a front tooth with its edge in the centre and its lip side outwards', () => {
    expect(surfaceLayout('21')).toEqual({ top: 'F', bottom: 'P', left: 'M', right: 'D', centre: 'I' });
  });
});
