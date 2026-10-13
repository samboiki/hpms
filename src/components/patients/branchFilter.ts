/** A visit as the Patients list holds it */
export interface BranchVisit {
  branch_id?: string | null;
  status?: string | null;
}

/** 'main' is the practice itself (visits not booked at a branch); any other value is a branch id */
export type BranchChoice = 'main' | string;

/**
 * Was the patient seen at this place? A cancelled booking is not a visit. "Head office" means a visit with no branch:
 * before, choosing the practice itself filtered nothing and its count was every patient, the same as "All Branches".
 */
export function seenAtBranch(visits: ReadonlyArray<BranchVisit> | null | undefined, choice: BranchChoice): boolean {
  return (visits ?? []).some(visit =>
    visit.status !== 'cancelled' && (choice === 'main' ? !visit.branch_id : visit.branch_id === choice)
  );
}

/**
 * The patients the branch window counts for each place, by the same rule as the filter, so the number next to a branch
 * is the number of patients choosing it shows (the old counts read at most 1,000 visits and counted cancelled ones).
 */
export function branchPatientCounts(
  patients: ReadonlyArray<{ visits?: ReadonlyArray<BranchVisit> | null }>,
  branchIds: ReadonlyArray<string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const choice of ['main', ...branchIds]) {
    counts[choice] = patients.filter(patient => seenAtBranch(patient.visits, choice)).length;
  }
  return counts;
}
