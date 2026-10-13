import { describe, it, expect } from 'vitest';
import { accountRelationshipForFormerMain, planAccountMove } from '../accountMove';

// Parity A3: when a spouse takes over the medical aid (death, divorce), the family's statements and credit control
// must follow to them in the same step; before, staff unlinked and relinked every member one by one
describe('moving the family account with "Make main member"', () => {
  it('moves the account the old main member holds, taking every other member along', () => {
    const plan = planAccountMove({
      formerMainId: 'H',
      formerMain: { holderId: null, memberIds: ['D', 'C1', 'C2'] },
      newMainId: 'D',
      newMain: { holderId: 'H', memberIds: [] }
    });
    expect(plan).toEqual({ kind: 'move', fromHolderId: 'H', followers: ['C1', 'C2'] });
  });

  it('moves it to a member who was not on the account yet (they pay for nobody else)', () => {
    expect(
      planAccountMove({ formerMainId: 'H', formerMain: { holderId: null, memberIds: ['C1'] }, newMainId: 'D', newMain: { holderId: null, memberIds: [] } })
    ).toEqual({ kind: 'move', fromHolderId: 'H', followers: ['C1'] });
  });

  it('leaves an account alone when someone else pays for the family (a parent outside the medical aid)', () => {
    expect(
      planAccountMove({ formerMainId: 'H', formerMain: { holderId: 'P', memberIds: [] }, newMainId: 'D', newMain: { holderId: 'P', memberIds: [] } })
    ).toEqual({ kind: 'none', why: 'paid_by_other' });
  });

  it('has nothing to move when each person pays for themselves', () => {
    expect(
      planAccountMove({ formerMainId: 'H', formerMain: { holderId: null, memberIds: [] }, newMainId: 'D', newMain: { holderId: null, memberIds: [] } })
    ).toEqual({ kind: 'none', why: 'no_family_account' });
  });

  it('sees a move that already happened, so pressing "Make main member" again only finishes the medical aid', () => {
    expect(
      planAccountMove({ formerMainId: 'H', formerMain: { holderId: 'D', memberIds: [] }, newMainId: 'D', newMain: { holderId: null, memberIds: ['H', 'C1'] } })
    ).toEqual({ kind: 'none', why: 'already_moved' });
  });

  it('does not take a new main member from another family\'s account without asking', () => {
    expect(
      planAccountMove({ formerMainId: 'H', formerMain: { holderId: null, memberIds: ['C1'] }, newMainId: 'D', newMain: { holderId: 'X', memberIds: [] } })
    ).toEqual({ kind: 'blocked', why: 'new_main_on_other_account' });
  });

  it('records the former main member as the new holder\'s spouse or child, else as another dependant', () => {
    expect(accountRelationshipForFormerMain('spouse')).toBe('spouse');
    expect(accountRelationshipForFormerMain('child')).toBe('child');
    expect(accountRelationshipForFormerMain('parent')).toBe('dependant');
    expect(accountRelationshipForFormerMain('other')).toBe('dependant');
  });
});
