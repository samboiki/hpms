import { describe, it, expect } from 'vitest';
import {
  getVisitStage,
  getBackwardMoves,
  getStageUpdate,
  getMoveLabel,
  getMoveConfirmMessage
} from '../visitStage';

// The stage decides which actions staff see. If it is derived wrongly, reception gets
// "Check In" on a cancelled visit or a doctor cannot reopen a visit completed by mistake.
describe('getVisitStage', () => {
  it('treats a cancelled flag as cancelled even if the status was never updated', () => {
    expect(getVisitStage({ status: 'scheduled', is_cancelled: true })).toBe('cancelled');
  });

  it('keeps a completed visit completed even if it was handed off earlier', () => {
    expect(getVisitStage({ status: 'completed', is_handoff: true })).toBe('completed');
  });

  it('recognises a visit handed to the nurse as its own stage, not "with doctor"', () => {
    expect(getVisitStage({ status: 'in-progress', is_handoff: true })).toBe('handed-off');
    expect(getVisitStage({ status: 'in-progress', is_handoff: false })).toBe('in-progress');
  });

  it('treats checked-in, triaged-ready and dashboard "ready" as waiting for the doctor', () => {
    expect(getVisitStage({ status: 'scheduled', is_checked_in: true })).toBe('checked-in');
    expect(getVisitStage({ status: 'scheduled', is_ready: true })).toBe('checked-in');
    expect(getVisitStage({ status: 'ready' })).toBe('checked-in');
  });

  it('treats unconfirmed and booked visits as scheduled', () => {
    expect(getVisitStage({ status: 'pending' })).toBe('scheduled');
    expect(getVisitStage({ status: 'scheduled' })).toBe('scheduled');
  });
});

// Mistakes happen at every step of a real clinic day; each must be correctable.
describe('getBackwardMoves', () => {
  it('lets a visit completed by mistake go back to the doctor or to the nurse handoff', () => {
    expect(getBackwardMoves('completed')).toEqual(['in-progress', 'handed-off']);
  });

  it('lets the doctor take a patient back from the nurse', () => {
    expect(getBackwardMoves('handed-off')).toContain('in-progress');
  });

  it('lets reception undo a check-in and undo a no-show when the patient walks in late', () => {
    expect(getBackwardMoves('checked-in')).toEqual(['scheduled']);
    expect(getBackwardMoves('no-show')).toContain('checked-in');
  });

  it('offers nothing earlier than scheduled', () => {
    expect(getBackwardMoves('scheduled')).toEqual([]);
  });
});

// Moving back must clear later-stage flags, or the visit reappears in the wrong column.
describe('getStageUpdate', () => {
  it('reopening to the doctor clears the handoff flag', () => {
    expect(getStageUpdate('in-progress')).toMatchObject({ status: 'in-progress', is_handoff: false });
  });

  it('reopening to the nurse keeps the consultation open and sets the handoff flag', () => {
    expect(getStageUpdate('handed-off')).toMatchObject({ status: 'in-progress', is_handoff: true });
  });

  it('undoing a check-in clears arrival and triage flags', () => {
    expect(getStageUpdate('scheduled')).toMatchObject({ status: 'scheduled', is_checked_in: false, is_ready: false });
  });

  it('restoring or un-no-showing a visit clears the cancelled flag', () => {
    expect(getStageUpdate('scheduled')).toMatchObject({ is_cancelled: false });
    expect(getStageUpdate('checked-in')).toMatchObject({ is_cancelled: false, is_checked_in: true });
  });

  it('every stage the update produces reads back as that same stage', () => {
    const stages = ['scheduled', 'checked-in', 'in-progress', 'handed-off', 'completed', 'no-show', 'cancelled'] as const;
    stages.forEach((stage) => expect(getVisitStage(getStageUpdate(stage))).toBe(stage));
  });
});

describe('labels and confirmation', () => {
  it('says what the correction does in plain words', () => {
    expect(getMoveLabel('completed', 'handed-off')).toBe('Reopen: back to nurse');
    expect(getMoveLabel('no-show', 'checked-in')).toBe('Patient arrived (undo no-show)');
    expect(getMoveLabel('checked-in', 'scheduled')).toBe('Undo check-in');
  });

  it('warns about the time slot when restoring a cancelled appointment', () => {
    expect(getMoveConfirmMessage('cancelled', 'scheduled')).toMatch(/time slot/);
  });
});
