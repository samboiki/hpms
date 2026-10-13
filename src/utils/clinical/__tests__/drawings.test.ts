import { describe, expect, it } from 'vitest';
import {
  DRAWING_TEMPLATES,
  drawingFileName,
  drawingTemplate,
  drawingTemplatesFor,
  drawingTitle,
  hasInk,
  smoothPath,
  toStrokePoint
} from '../drawings';

describe('the templates a practice can draw on', () => {
  // A medical practice has no use for a tooth chart, and a dental practice reaches for one first
  it('offers tooth charts to dental practices only, and first', () => {
    expect(drawingTemplatesFor(false).map((template) => template.id)).toEqual(['body', 'blank']);
    expect(drawingTemplatesFor(true).map((template) => template.id)).toEqual(['teeth-adult', 'teeth-child', 'body', 'blank']);
  });

  it('falls back to a blank page for a template it does not know (a drawing saved by a later version)', () => {
    expect(drawingTemplate('something-new').id).toBe('blank');
    expect(DRAWING_TEMPLATES.every((template) => template.aspect > 0)).toBe(true);
  });
});

describe('a saved drawing in the patient file', () => {
  it('is titled by its template and what it shows, so the Media tab says what it is', () => {
    expect(drawingTitle('teeth-adult', '  crown   on 21 ')).toBe('Drawing: Teeth (adult), crown on 21');
    expect(drawingTitle('body', '')).toBe('Drawing: Body, front and back');
    expect(drawingTitle('blank', 'x'.repeat(400))).toHaveLength(250);
  });

  it('gets a file name that cannot leave its folder', () => {
    expect(drawingFileName('2026-10-13', 'k3x9q2')).toBe('drawing-2026-10-13-k3x9q2.png');
    expect(drawingFileName('2026-10-13', '../../etc')).toBe('drawing-2026-10-13-etc.png');
    expect(drawingFileName('2026-10-13', '///')).toBe('drawing-2026-10-13-x.png');
  });
});

describe('drawing with a finger, a pen or the mouse', () => {
  // Points are kept as shares of the drawing, so a line drawn on a phone lands in the same place on the saved picture
  it('keeps a point as a share of the drawing, and inside it', () => {
    expect(toStrokePoint(50, 25, 200, 100)).toEqual([0.25, 0.25]);
    expect(toStrokePoint(-10, 150, 200, 100)).toEqual([0, 1]);
    expect(toStrokePoint(10, 10, 0, 0)).toEqual([0, 0]);
  });

  it('saves nothing until a line is drawn', () => {
    expect(hasInk([])).toBe(false);
    expect(hasInk([{ colour: '#111827', width: 4, points: [] }])).toBe(false);
    expect(hasInk([{ colour: '#111827', width: 4, points: [[0.5, 0.5]] }])).toBe(true);
  });

  it('draws a smooth line through every point, closed when asked', () => {
    const open = smoothPath([[0, 0], [10, 0], [10, 10]], false);
    expect(open.startsWith('M0 0 C')).toBe(true);
    expect(open.endsWith('10 10')).toBe(true);
    expect(open.match(/C/g)).toHaveLength(2);
    const closed = smoothPath([[0, 0], [10, 0], [10, 10]], true);
    expect(closed.match(/C/g)).toHaveLength(3);
    expect(closed.endsWith('Z')).toBe(true);
    expect(smoothPath([[1, 1]], false)).toBe('');
  });
});
