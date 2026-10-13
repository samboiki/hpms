/**
 * Making another family member the main member of a medical aid membership. The plan (which record
 * changes how) comes from src/utils/patients/medicalAidMember.ts; this applies it record by record.
 * Each update can be applied again without harm, so a swap interrupted half-way (a lost connection)
 * is completed by running it again.
 */
import { supabase } from '../lib/supabase';
import { planMainMemberSwap, type FamilyMemberRecord } from '../utils/patients/medicalAidMember';

export interface SwapResult {
  newMainMemberName: string;
  updated: number;
}

export async function swapMainMember(
  family: readonly FamilyMemberRecord[],
  newMainPatientId: string,
  formerMainRelationship: string
): Promise<SwapResult> {
  const plan = planMainMemberSwap(family, newMainPatientId, formerMainRelationship);
  if (!plan.ok) throw new Error(plan.error);
  let updated = 0;
  for (const update of plan.updates) {
    const { error } = await supabase.from('medical_aid_details').update(update.changes).eq('id', update.medicalAidId);
    if (error) {
      // The new main member is promoted last, so the same button finishes the swap
      throw new Error(
        `The main member was only partly changed (${updated} of ${plan.updates.length} updates). Choose "Make main member" again to finish. (${error.message})`
      );
    }
    updated += 1;
  }
  return { newMainMemberName: plan.newMainMemberName, updated };
}
