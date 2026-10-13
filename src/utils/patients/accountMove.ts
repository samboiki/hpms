/**
 * Moving a family's billing account when another member becomes the main member (parity A3). The database moves it in
 * one step (dc_move_account_holder, proposals/2026-10-12-family-account-move.sql: every link of the old holder closed
 * with the reason, the old holder and the rest of the family linked to the new one). This decides, before anything is
 * sent, whether there is an account to move, who follows, and how the former main member is related to the new holder.
 */
import type { AccountRelationship } from '../../services/ledger/familyAccounts';

/** The links in force of one patient: who pays for them (null: nobody) and whom they pay for */
export interface AccountLinks {
  holderId: string | null;
  memberIds: readonly string[];
}

export type AccountMovePlan =
  /** The former main member holds the family's account: it moves; `followers` are the others who move with it */
  | { kind: 'move'; fromHolderId: string; followers: string[] }
  /** Nothing to move: no family account, someone else pays for the family, or it already moved */
  | { kind: 'none'; why: 'no_family_account' | 'paid_by_other' | 'already_moved' }
  /** The new main member is on another family's account: the account cannot move to them */
  | { kind: 'blocked'; why: 'new_main_on_other_account' };

/**
 * Whether making `newMainId` the main member moves an account. Only an account the former main member holds (they pay
 * for others and nobody pays for them) moves; an account someone else holds stays with that person.
 */
export function planAccountMove(input: {
  formerMainId: string;
  formerMain: AccountLinks;
  newMainId: string;
  newMain: AccountLinks;
}): AccountMovePlan {
  if (input.formerMain.holderId === input.newMainId) return { kind: 'none', why: 'already_moved' };
  if (input.formerMain.holderId) return { kind: 'none', why: 'paid_by_other' };
  if (input.formerMain.memberIds.length === 0) return { kind: 'none', why: 'no_family_account' };
  if (input.newMain.holderId && input.newMain.holderId !== input.formerMainId) return { kind: 'blocked', why: 'new_main_on_other_account' };
  return {
    kind: 'move',
    fromHolderId: input.formerMainId,
    followers: input.formerMain.memberIds.filter((id) => id !== input.newMainId)
  };
}

/**
 * The account relationship of the former main member to the new holder, from what the medical aid swap says they
 * become (FORMER_MAIN_MEMBER_RELATIONSHIPS: spouse, parent, child, other dependant).
 */
export function accountRelationshipForFormerMain(formerMainRelationship: string): AccountRelationship {
  if (formerMainRelationship === 'spouse') return 'spouse';
  if (formerMainRelationship === 'child') return 'child';
  return 'dependant';
}

/** The reason kept on the account, in plain words */
export const MAIN_MEMBER_CHANGE_REASON_MIN = 3;
export const MAIN_MEMBER_CHANGE_REASON_MAX = 200;
