/**
 * The one ICD-10 code search (parity E14) and the per-line code entry built on it: a practitioner finds a code in the
 * medical aids' full list by code or by words, the practice's usual codes come first, and codes a fund would reject
 * are marked before the claim is ever made. The list itself is a stand-in here: nothing reaches the database.
 */
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Icd10SearchInput from '../Icd10SearchInput';
import Icd10CodeInput from '../Icd10CodeInput';
import type { Icd10MasterEntry, Icd10Option } from '../../../utils/billing/icd10Master';
import type { Icd10Selection } from '../../../utils/billing/icd10';

const entry = (code: string, description: string, overrides: Partial<Icd10MasterEntry> = {}): Icd10MasterEntry => ({
  code,
  description,
  validClinicalUse: true,
  validPrimary: true,
  isAsterisk: false,
  ageRange: null,
  gender: null,
  discontinued: false,
  endDate: null,
  ...overrides
});

const LIST = [
  entry('J06', 'Acute upper respiratory infections of multiple and unspecified sites', { validClinicalUse: false, validPrimary: false }),
  entry('J06.0', 'Acute laryngopharyngitis'),
  entry('J06.9', 'Acute upper respiratory infection, unspecified'),
  entry('I10', 'Essential (primary) hypertension'),
  entry('D63.0', 'Anaemia in neoplastic disease', { isAsterisk: true, validPrimary: false })
];

const { service } = vi.hoisted(() => ({
  service: {
    listStatus: 'ready' as 'ready' | 'not-set-up',
    usual: [] as string[],
    searched: [] as string[]
  }
}));

// A stand-in for the database search: the start of a code, or every word at the start of a description word
vi.mock('../../../services/icd10Service', () => ({
  searchIcd10Codes: async (text: string) => {
    service.searched.push(text);
    if (service.listStatus !== 'ready') return { status: service.listStatus, entries: [] };
    const typed = text.trim().toLowerCase();
    const code = typed.replace(/^([a-z]\d\d)(\d)$/, '$1.$2').toUpperCase();
    const entries = LIST.filter(
      item => item.code.startsWith(code) || typed.split(/\s+/).every(word => item.description.toLowerCase().split(/[^a-z0-9]+/).some(part => part.startsWith(word)))
    );
    return { status: 'ready', entries };
  },
  lookupIcd10Codes: async (codes: readonly string[]) => {
    if (service.listStatus !== 'ready') return { status: service.listStatus, entries: new Map() };
    return { status: 'ready', entries: new Map(LIST.filter(item => codes.includes(item.code)).map(item => [item.code, item])) };
  },
  knownIcd10Codes: () => null,
  practiceUsualIcd10Codes: async () => service.usual
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { selectedPracticeId: string | null; user: { practice_id: string } }) => unknown) =>
    selector({ selectedPracticeId: null, user: { practice_id: 'practice-1' } })
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

beforeEach(() => {
  service.listStatus = 'ready';
  service.usual = [];
  service.searched = [];
});

const SearchBox: React.FC<{ onPick: (option: Icd10Option) => void; position?: 'main' | 'other' }> = ({ onPick, position }) => {
  const [text, setText] = useState('');
  return <Icd10SearchInput ariaLabel="ICD-10 search" value={text} onChange={setText} onPick={onPick} position={position} />;
};

describe('finding a code in the medical aids\' list', () => {
  it('finds a code typed without its dot, offers the exact code first and takes it with Enter', async () => {
    const onPick = vi.fn();
    render(<SearchBox onPick={onPick} />);
    const box = screen.getByRole('combobox', { name: 'ICD-10 search' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'j069' } });

    const list = await screen.findByRole('listbox');
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('J06.9');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ code: 'J06.9' }));
  });

  it('finds codes by the words of their description', async () => {
    render(<SearchBox onPick={vi.fn()} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'acute resp' } });
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      expect.stringContaining('J06Acute upper respiratory infections'),
      expect.stringContaining('J06.9Acute upper respiratory infection, unspecified')
    ]);
  });

  // A heading or an asterisk code first gets the claim line rejected: say so before it is chosen
  it('marks a category heading, and an asterisk code where the main diagnosis goes', async () => {
    render(<SearchBox onPick={vi.fn()} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'j06' } });
    expect(await screen.findByRole('option', { name: /^J06\s*Acute upper respiratory infections/ })).toHaveTextContent('Category heading: choose a code under it');
    fireEvent.change(box, { target: { value: 'anaemia' } });
    expect(await screen.findByRole('option', { name: /D63\.0/ })).toHaveTextContent('Asterisk code: not the main code');
  });

  it("puts the practice's usual codes first as soon as the box opens", async () => {
    service.usual = ['I10'];
    render(<SearchBox onPick={vi.fn()} />);
    fireEvent.focus(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: /^I10\s*Essential \(primary\) hypertension/ });
    expect(option).toHaveTextContent('Suggested');
  });

  it('says when the full list is not set up yet, so the practitioner types the code instead', async () => {
    service.listStatus = 'not-set-up';
    render(<SearchBox onPick={vi.fn()} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'j06' } });
    expect(await screen.findByText('The full ICD-10 list is not set up yet: type the code.', { selector: 'p' })).toBeInTheDocument();
  });

  it('closes the list with Escape without choosing anything', async () => {
    const onPick = vi.fn();
    render(<SearchBox onPick={onPick} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'j06' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('the ICD-10 codes of a billing line', () => {
  const Line: React.FC<{ initial: Icd10Selection }> = ({ initial }) => {
    const [value, setValue] = useState(initial);
    return <Icd10CodeInput value={value} onChange={setValue} label="ICD-10 code" />;
  };

  it('shows the description of the chosen code from the full list', async () => {
    render(<Line initial={{ primary: 'I10', secondary: [] }} />);
    expect(await screen.findByText('Essential (primary) hypertension')).toBeInTheDocument();
  });

  // The same check claim review makes: the fund rejects a heading, so the practitioner hears it at the visit
  it('says a category heading is not a diagnosis as soon as it is entered', async () => {
    render(<Line initial={{ primary: 'J06', secondary: [] }} />);
    expect(await screen.findByText(/is a category heading, not a diagnosis/)).toBeInTheDocument();
  });

  it('adds a secondary code chosen from the list', async () => {
    render(<Line initial={{ primary: 'I10', secondary: [] }} />);
    const add = screen.getByRole('combobox', { name: /Secondary codes/ });
    fireEvent.focus(add);
    fireEvent.change(add, { target: { value: 'laryngo' } });
    fireEvent.click(await screen.findByRole('option', { name: /J06\.0/ }));
    await waitFor(() => expect(screen.getByText('J06.0')).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: /Secondary codes/ })).toHaveValue('');
  });
});
