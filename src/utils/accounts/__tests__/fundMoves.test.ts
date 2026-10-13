import { describe, expect, it } from 'vitest';
import {
  alreadyThere,
  describeChoice,
  describeFundMoveResult,
  fundKeyOf,
  fundMovePayload,
  fundMoveProblem,
  groupFunds,
  patientsToMove,
  type FundMemberRow,
  type FundProvider
} from '../fundMoves';

const NMC: FundProvider = { id: 'prov-nmc', name: 'Namibia Medical Care', reference: 'NMC1' };
const NHP: FundProvider = { id: 'prov-nhp', name: 'Namibia Health Plan', reference: 'NHPM' };
const PROVIDERS = [NMC, NHP];

let next = 0;
const row = (changes: Partial<FundMemberRow>): FundMemberRow => {
  next += 1;
  return {
    medicalAidId: `ma-${next}`,
    patientId: `p-${next}`,
    patientName: `Patient ${String.fromCharCode(64 + next)}`,
    provider: 'Namibia Medical Care',
    scheme: 'Standard',
    planType: 'Standard',
    providerId: NMC.id,
    relationship: 'self',
    ...changes
  };
};

const ROWS = [
  row({ patientName: 'Zara Test' }),
  row({ patientName: 'Abel Test', planType: 'standard ' }),
  row({ patientName: 'Cleo Test', planType: 'Plus', relationship: 'child' }),
  // Typed differently and never linked to the fund: still NMC to a person reading it
  row({ patientName: 'Dina Test', provider: 'NMC', providerId: null, planType: '' }),
  row({ patientName: 'Eli Test', provider: 'Namibia Health Plan', providerId: NHP.id, planType: 'Gold' })
];

describe('the funds and options patients are on', () => {
  it('groups spellings of one fund together, so a practice moves all of its NMC patients in one go', () => {
    expect(fundKeyOf(ROWS[3], PROVIDERS)).toBe(fundKeyOf(ROWS[0], PROVIDERS));
    const groups = groupFunds(ROWS, PROVIDERS);
    expect(groups.map(group => [group.label, group.count])).toEqual([['Namibia Medical Care', 4], ['Namibia Health Plan', 1]]);
    expect(groups[0].spellings).toEqual(['Namibia Medical Care', 'NMC']);
  });

  it('treats options as one whatever the case and spaces, and names those with none', () => {
    const [nmc] = groupFunds(ROWS, PROVIDERS);
    expect(nmc.options.map(option => [option.label, option.count])).toEqual([['Standard', 2], ['Option not recorded', 1], ['Plus', 1]]);
  });
});

describe('who a choice moves', () => {
  const nmcKey = fundKeyOf(ROWS[0], PROVIDERS);

  it('takes the chosen options only, A to Z, so the preview reads like the patient list', () => {
    const moving = patientsToMove(ROWS, PROVIDERS, { fundKey: nmcKey, optionKeys: ['standard'], scope: 'everyone', search: '' }, null);
    expect(moving.map(item => item.patientName)).toEqual(['Abel Test', 'Zara Test']);
  });

  it('can keep to main members or dependants, the way funds move a family', () => {
    const main = patientsToMove(ROWS, PROVIDERS, { fundKey: nmcKey, optionKeys: [], scope: 'main', search: '' }, null);
    const dependants = patientsToMove(ROWS, PROVIDERS, { fundKey: nmcKey, optionKeys: [], scope: 'dependants', search: '' }, null);
    expect(dependants.map(item => item.patientName)).toEqual(['Cleo Test']);
    expect(main).toHaveLength(3);
  });

  it('leaves out patients already on the fund and option chosen, so nothing is "moved" for nothing', () => {
    const target = { providerId: NMC.id, option: 'Standard' };
    expect(alreadyThere(ROWS[0], target)).toBe(true);
    expect(alreadyThere(ROWS[3], target)).toBe(false);
    const moving = patientsToMove(ROWS, PROVIDERS, { fundKey: nmcKey, optionKeys: [], scope: 'everyone', search: '' }, target);
    expect(moving.map(item => item.patientName)).toEqual(['Cleo Test', 'Dina Test']);
  });

  it('describes the choice in words kept with the move', () => {
    const [nmc] = groupFunds(ROWS, PROVIDERS);
    expect(describeChoice(nmc, { optionKeys: ['standard', 'plus'], scope: 'main' })).toBe('Namibia Medical Care, options Standard, Plus; main members only');
    expect(describeChoice(nmc, { optionKeys: [], scope: 'everyone' })).toBe('Namibia Medical Care, every option');
  });
});

describe('making the move', () => {
  it('needs patients, a fund and a reason, because each file keeps the reason', () => {
    expect(fundMoveProblem({ selected: 0, target: { providerId: NHP.id, option: '' }, reason: 'Merged' })).toMatch(/at least one/);
    expect(fundMoveProblem({ selected: 2, target: null, reason: 'Merged' })).toMatch(/fund/);
    expect(fundMoveProblem({ selected: 2, target: { providerId: NHP.id, option: '' }, reason: ' x ' })).toMatch(/why/);
    expect(fundMoveProblem({ selected: 2001, target: { providerId: NHP.id, option: '' }, reason: 'Merged' })).toMatch(/at most/);
    expect(fundMoveProblem({ selected: 2, target: { providerId: NHP.id, option: '' }, reason: 'The fund merged' })).toBeNull();
  });

  it('sends each medical aid as the preview showed it, so a file changed since is left alone', () => {
    const payload = fundMovePayload([ROWS[3]], { providerId: NHP.id, option: '  Gold  Plus ' }, ' Merged ', 'NMC, every option');
    expect(payload).toEqual({
      reason: 'Merged',
      from_label: 'NMC, every option',
      to: { provider_id: NHP.id, option: 'Gold Plus' },
      patients: [{ patient_id: ROWS[3].patientId, medical_aid_id: ROWS[3].medicalAidId, expected: { provider: 'NMC', plan_type: '', medical_aid_provider_id: null } }]
    });
  });

  it('reports the outcome in one sentence, including those left as they were', () => {
    expect(describeFundMoveResult({ moveId: 'm', moved: 12, claimsMoved: 3, skipped: [{ patientId: 'a', why: 'changed' }, { patientId: 'b', why: 'already' }] }))
      .toBe("12 patients moved; 3 claims not sent yet went to the new fund's batch; 1 was changed since the list was made and left as it is; 1 was already there.");
    expect(describeFundMoveResult({ moveId: null, moved: 0, claimsMoved: 0, skipped: [{ patientId: 'a', why: 'not_found' }] })).toBe('0 patients moved; 1 could not be found any more.');
  });
});
