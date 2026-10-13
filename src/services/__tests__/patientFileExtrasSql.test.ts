import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LETTER_KINDS } from '../../utils/templates/letterTemplates';
import { CONSENT_SIGNERS, MAX_SIGNER_NAME } from '../../utils/clinical/consent';
import { MAX_PRIVATE_NOTE } from '../privateNotesService';

const SQL = readFileSync('proposals/2026-10-13-patient-file-extras.sql', 'utf8');

const quotedList = (pattern: RegExp): string[] => {
  const match = pattern.exec(SQL);
  expect(match, `${pattern} not found in the proposal`).not.toBeNull();
  return [...(match?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map(item => item[1]);
};

// The screens and the database must agree, or a template kind or a signer the screen offers is refused on save
describe('the patient-file extras proposal and the app agree', () => {
  it('on the letter template kinds, in the table and in save_letter_template', () => {
    const kinds = LETTER_KINDS.map(info => info.kind).sort();
    expect(quotedList(/letter_templates_kind_check\s+CHECK \(kind IN \(([^)]*)\)\)/).sort()).toEqual(kinds);
    expect(quotedList(/IF v_kind NOT IN \(([^)]*)\) THEN/).sort()).toEqual(kinds);
  });

  it('on who may sign a consent form, and the length of their name', () => {
    const signers = CONSENT_SIGNERS.map(signer => signer.value).sort();
    expect(quotedList(/signed_by\s+text NOT NULL CHECK \(signed_by IN \(([^)]*)\)\)/).sort()).toEqual(signers);
    expect(SQL).toContain(`char_length(btrim(signer_name)) BETWEEN 1 AND ${MAX_SIGNER_NAME}`);
  });

  it('on the length of a private note', () => {
    expect(SQL).toContain(`char_length(btrim(body)) BETWEEN 1 AND ${MAX_PRIVATE_NOTE}`);
    expect(SQL).toContain(`IF char_length(v_body) NOT BETWEEN 1 AND ${MAX_PRIVATE_NOTE} THEN`);
  });
});
