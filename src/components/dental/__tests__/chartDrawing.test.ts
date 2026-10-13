import { describe, it, expect } from 'vitest';
import { chartRows } from '../../../utils/dental/fdi';
import { nextTooth } from '../chartNavigation';
import { toothKind, toothShape } from '../toothShapes';

// Business rule: the chart is read like the mouth. A practitioner trusts it only when each drawing is the tooth they
// see: incisors, canines, premolars and molars in their places, an upper molar with three roots and a lower one with
// two, milk teeth smaller than permanent ones.
describe('each tooth is drawn as its kind', () => {
  it('draws the permanent teeth of both jaws by their position', () => {
    expect(['11', '12', '13', '14', '15', '16', '17', '18'].map(toothKind)).toEqual([
      'central',
      'incisor',
      'canine',
      'premolarTwoRoots',
      'premolar',
      'molar',
      'molar',
      'molar'
    ]);
    expect(['41', '42', '43', '44', '45', '46', '47', '48'].map(toothKind)).toEqual([
      'incisor',
      'incisor',
      'canine',
      'premolar',
      'premolar',
      'lowerMolar',
      'lowerMolar',
      'lowerMolar'
    ]);
  });

  it('gives an upper molar three roots and a lower molar two', () => {
    const upper = toothShape('26');
    const lower = toothShape('36');
    expect([upper.canals.length, lower.canals.length]).toEqual([3, 2]);
    expect(upper.backRoots).toHaveLength(1);
  });

  it('draws milk teeth smaller, with milk molars at positions 4 and 5, and wisdom teeth a little smaller', () => {
    expect(['51', '53', '54', '55', '84'].map(toothKind)).toEqual(['central', 'canine', 'molar', 'molar', 'lowerMolar']);
    expect([toothShape('55').scale, toothShape('16').scale, toothShape('18').scale]).toEqual([0.8, 1, 0.9]);
  });
});

// Business rule: the chart works without a mouse. It is one Tab stop; the arrow keys move along a jaw and between
// the jaws to the tooth at the same place, so a keyboard user reaches any tooth in a few presses.
describe('moving round the chart with the keyboard', () => {
  const adult = chartRows('adult');
  const mixed = chartRows('mixed');

  it('moves along a jaw across the middle, and stops at the ends', () => {
    expect(nextTooth(adult, '11', 'ArrowRight')).toBe('21');
    expect(nextTooth(adult, '21', 'ArrowLeft')).toBe('11');
    expect(nextTooth(adult, '18', 'ArrowLeft')).toBeNull();
    expect([nextTooth(adult, '36', 'Home'), nextTooth(adult, '36', 'End')]).toEqual(['48', '38']);
  });

  it('moves between the jaws to the tooth at the same place', () => {
    expect(nextTooth(adult, '16', 'ArrowDown')).toBe('46');
    expect(nextTooth(adult, '37', 'ArrowUp')).toBe('27');
    expect(nextTooth(adult, '16', 'ArrowUp')).toBeNull();
  });

  it('reaches the milk teeth between the permanent jaws in a mixed chart', () => {
    expect(nextTooth(mixed, '16', 'ArrowDown')).toBe('55');
    expect(nextTooth(mixed, '18', 'ArrowDown')).toBe('55');
    expect(nextTooth(mixed, '21', 'ArrowDown')).toBe('61');
    expect(nextTooth(mixed, '85', 'ArrowDown')).toBe('45');
  });

  it('ignores other keys', () => {
    expect(nextTooth(adult, '11', 'Enter')).toBeNull();
  });
});
