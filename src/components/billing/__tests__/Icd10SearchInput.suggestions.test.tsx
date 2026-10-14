/**
 * The ICD-10 code box under a billing line offers the codes suggested for the line's tariff code. Why: there is no
 * official table that links a tariff code to a diagnosis, and the diagnosis is the practitioner's, so the box may only
 * OFFER codes (the practice's usual code, what it billed most, a reviewed starter list, what the procedure is usually
 * done for, what is common in the practice's kind of practice), in that order, each with a plain reason, and must never
 * fill a diagnosis in or pick one by itself. The database is a stand-in here.
 */
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Icd10SearchInput from '../Icd10SearchInput';
import type { Icd10MasterEntry, Icd10Option } from '../../../utils/billing/icd10Master';
import { EMPTY_TARIFF_ICD10_DATA, toCommonCodes, toLearnedMap, toProcedureCodes, toStarterMap } from '../../../utils/billing/tariffIcd10Suggestions';

const entry = (code: string, description: string): Icd10MasterEntry => ({
  code, description, validClinicalUse: true, validPrimary: true, isAsterisk: false, ageRange: null, gender: null, discontinued: false, endDate: null
});
const LIST = [
  entry('Z34.0', 'Supervision of normal first pregnancy'),
  entry('Z34.9', 'Supervision of normal pregnancy, unspecified'),
  entry('Z35.9', 'Supervision of high-risk pregnancy, unspecified'),
  entry('I10', 'Essential (primary) hypertension'),
  entry('K35.8', 'Acute appendicitis, other and unspecified'),
  entry('K37', 'Unspecified appendicitis'),
  entry('J06.9', 'Acute upper respiratory infection, unspecified')
];

const { service } = vi.hoisted(() => ({
  service: {
    load: null as unknown,
    asked: [] as Array<string | null>,
    usual: [] as string[],
    procedure: { status: 'ready', codes: [] as unknown[] },
    procedureAsked: [] as Array<[string | null, string]>
  }
}));

vi.mock('../../../services/icd10Service', () => ({
  searchIcd10Codes: async () => ({ status: 'ready', entries: [] }),
  lookupIcd10Codes: async (codes: readonly string[]) => ({ status: 'ready', entries: new Map(LIST.filter(item => codes.includes(item.code)).map(item => [item.code, item])) }),
  knownIcd10Codes: () => null,
  practiceUsualIcd10Codes: async () => service.usual
}));
vi.mock('../../../services/tariffIcd10SuggestionService', () => ({
  loadTariffIcd10Suggestions: async (practiceId: string | null) => {
    service.asked.push(practiceId);
    return service.load;
  },
  loadProcedureSuggestions: async (discipline: string | null, tariffCode: string) => {
    service.procedureAsked.push([discipline, tariffCode]);
    return service.procedure;
  }
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { selectedPracticeId: string | null; user: { practice_id: string } }) => unknown) =>
    selector({ selectedPracticeId: null, user: { practice_id: 'practice-1' } })
}));

const READY = { usual: 'ready', learned: 'ready', starter: 'ready', common: 'ready' };

beforeEach(() => {
  service.asked = [];
  service.usual = [];
  service.procedure = { status: 'ready', codes: [] };
  service.procedureAsked = [];
  service.load = {
    data: {
      ...EMPTY_TARIFF_ICD10_DATA,
      usual: new Map([['2601', 'Z34.0']]),
      learned: toLearnedMap([{ tariff_code: '2601', icd10_code: 'Z34.9', times_used: 12 }, { tariff_code: '2601', icd10_code: 'I10', times_used: 1 }]),
      starter: toStarterMap([
        { code: '2601', icd10_code: 'Z34.9', sort_order: 1, rationale: 'Antenatal visit: supervision of a normal pregnancy' },
        { code: '2601', icd10_code: 'Z35.9', sort_order: 2, rationale: 'Antenatal visit: a high-risk pregnancy' }
      ])
    },
    parts: READY,
    discipline: '014'
  };
});

const Box: React.FC<{ onPick: (option: Icd10Option) => void; tariffCode?: string }> = ({ onPick, tariffCode }) => {
  const [text, setText] = useState('');
  return <Icd10SearchInput ariaLabel="ICD-10 search" value={text} onChange={setText} onPick={onPick} tariffCode={tariffCode} />;
};

const optionTexts = () => screen.getAllByRole('option').map(option => option.textContent ?? '');
const optionCodes = () => screen.getAllByRole('option').map(option => option.querySelector('span')?.textContent ?? '');

describe('the codes suggested for the line\'s tariff code', () => {
  it("offers the practice's usual code first, then what it billed most, then the starter codes, each with its reason", async () => {
    render(<Box onPick={vi.fn()} tariffCode="2601" />);
    fireEvent.focus(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    const texts = optionTexts();
    expect(texts[0]).toContain('Z34.0');
    expect(texts[0]).toContain("Your practice's usual code for 2601");
    expect(texts[1]).toContain('Z34.9');
    expect(texts[1]).toContain('Billed with 2601 12 times in the last 2 years');
    expect(texts[2]).toContain('I10');
    expect(texts[2]).toContain('Billed with 2601 once in the last 2 years');
    expect(texts[3]).toContain('Z35.9');
    expect(texts[3]).toContain('Antenatal visit: a high-risk pregnancy');
    // They are labelled as suggestions, like the line's other suggested codes
    texts.forEach(text => expect(text).toContain('Suggested'));
  });

  // The diagnosis is the practitioner's: opening the box, or pressing Enter before choosing, must change nothing
  it('never chooses a code by itself', async () => {
    const onPick = vi.fn();
    render(<Box onPick={onPick} tariffCode="2601" />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
    expect(box).toHaveValue('');
  });

  it('takes the code the practitioner clicks', async () => {
    const onPick = vi.fn();
    render(<Box onPick={onPick} tariffCode="2601" />);
    fireEvent.focus(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ code: 'Z34.9', suggested: true }));
  });

  it('keeps the reason on a suggestion while the practitioner types to narrow the list', async () => {
    render(<Box onPick={vi.fn()} tariffCode="2601" />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    fireEvent.change(box, { target: { value: 'Z35' } });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(optionTexts()[0]).toContain('Z35.9');
    expect(optionTexts()[0]).toContain('Antenatal visit: a high-risk pregnancy');
  });

  it('asks for nothing when the box belongs to no billing line', async () => {
    render(<Box onPick={vi.fn()} />);
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByText('Type a code (J06.9) or words (acute sinusitis).', { selector: 'p' });
    expect(service.asked).toEqual([]);
  });

  it('asks for nothing until the box is opened', () => {
    render(<Box onPick={vi.fn()} tariffCode="2601" />);
    expect(service.asked).toEqual([]);
  });

  // Before the database update, or when nothing is known for the code, the box works exactly as it did
  it('shows no suggestions, and no error, when there is nothing for the code', async () => {
    service.load = { data: EMPTY_TARIFF_ICD10_DATA, parts: { usual: 'not-set-up', learned: 'not-set-up', starter: 'not-set-up', common: 'not-set-up' }, discipline: null };
    render(<Box onPick={vi.fn()} tariffCode="2601" />);
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByText('Type a code (J06.9) or words (acute sinusitis).', { selector: 'p' });
    await waitFor(() => expect(service.asked).toEqual(['practice-1']));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    // With no discipline there is nothing to read the rules for
    expect(service.procedureAsked).toEqual([]);
  });
});

describe('the codes suggested for the procedure and for the kind of practice', () => {
  beforeEach(() => {
    service.load = {
      data: {
        ...EMPTY_TARIFF_ICD10_DATA,
        learned: toLearnedMap([{ tariff_code: '1675', icd10_code: 'K35.8', times_used: 4 }]),
        common: toCommonCodes([
          { icd10: 'J06.9', reason: 'One of the most common diagnoses in general practice', rank: 1, source: null },
          { icd10: 'I10', reason: 'One of the most common diagnoses in general practice', rank: 2, source: 'https://example.org/list - A published list' }
        ])
      },
      parts: READY,
      discipline: '014'
    };
    service.procedure = {
      status: 'ready',
      codes: toProcedureCodes([
        { icd10: 'K35.8', reason: 'Usual reasons for removing the appendix' },
        { icd10: 'K37', reason: 'Usual reasons for removing the appendix' }
      ])
    };
  });

  // What the practice itself billed is the strongest evidence; then what the procedure is usually done for; the common list is the last resort
  it('offers what the practice billed, then what the procedure is usually done for, then what is common, each once with its reason', async () => {
    render(<Box onPick={vi.fn()} tariffCode="1675" />);
    fireEvent.focus(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    const texts = optionTexts();
    expect(optionCodes()).toEqual(['K35.8', 'K37', 'J06.9', 'I10']);
    expect(texts[0]).toContain('Billed with 1675 4 times in the last 2 years');
    expect(texts[1]).toContain('Usual reasons for removing the appendix');
    expect(texts[2]).toContain('One of the most common diagnoses in general practice');
    expect(texts[3]).toContain('One of the most common diagnoses in general practice (published list)');
    texts.forEach(text => expect(text).toContain('Suggested'));
    // The rules are read for the practice's discipline and this line's own code
    expect(service.procedureAsked[0]).toEqual(['014', '1675']);
  });

  it('never chooses one of them by itself', async () => {
    const onPick = vi.fn();
    render(<Box onPick={onPick} tariffCode="1675" />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ code: 'K37', suggested: true }));
  });

  it('still shows the common diagnoses when no rule covers the code (a consultation)', async () => {
    service.procedure = { status: 'ready', codes: [] };
    render(<Box onPick={vi.fn()} tariffCode="0190" />);
    fireEvent.focus(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(optionCodes()).toEqual(['J06.9', 'I10']);
  });

  it('shows the rest of the suggestions, and no error, when the rules cannot be read', async () => {
    service.procedure = { status: 'error', codes: [] };
    render(<Box onPick={vi.fn()} tariffCode="1675" />);
    fireEvent.focus(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    expect(optionCodes()).toEqual(['K35.8', 'J06.9', 'I10']);
  });
});
