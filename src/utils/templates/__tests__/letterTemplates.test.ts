import { describe, expect, it } from 'vitest';
import {
  LETTER_TEMPLATE_EXAMPLES,
  blankLetterTemplate,
  checkLetterTemplate,
  isLetterKind,
  listLetterProblem,
  type LetterTemplateDraft
} from '../letterTemplates';
import { MESSAGE_TEMPLATE_EXAMPLES, canChangeMessageTemplates, checkMessageTemplate } from '../messageTemplates';

const draft = (overrides: Partial<LetterTemplateDraft> = {}): LetterTemplateDraft => ({
  kind: 'certificate',
  name: 'Attendance certificate',
  title: 'CERTIFICATE OF ATTENDANCE',
  recipient: '',
  subject: 'Re: {{patientName}}',
  greeting: 'To whom it may concern',
  body: 'This is to confirm that {{patientName}} attended on {{visitDate}}.',
  ...overrides
});

describe('letter template examples', () => {
  // A practice starts from these: one that failed the save function's checks, or used a field nothing fills, would
  // be a broken first impression
  it('pass every check the database makes and use only fields a letter can fill', () => {
    for (const example of LETTER_TEMPLATE_EXAMPLES) expect(checkLetterTemplate(example)).toEqual([]);
  });

  it('cover the kinds practices asked for: sick note, certificate, referral, recall and consent (parity C14)', () => {
    expect(new Set(LETTER_TEMPLATE_EXAMPLES.map(example => example.kind))).toEqual(
      new Set(['sick_note', 'certificate', 'referral', 'recall', 'consent'])
    );
  });

  it('start a consent form without a greeting: the patient signs it, it is not addressed to anyone', () => {
    expect(blankLetterTemplate('consent')).toMatchObject({ title: 'CONSENT TO TREATMENT', greeting: '' });
  });

  it('start a blank template of a kind with its usual title and greeting', () => {
    expect(blankLetterTemplate('referral')).toMatchObject({ title: 'REFERRAL LETTER', greeting: 'Dear colleague', name: '', body: '' });
  });
});

describe('checkLetterTemplate', () => {
  it('asks for a name, a title and the letter in the same words as the database', () => {
    expect(checkLetterTemplate(draft({ name: ' ', title: '', body: 'Hi' }))).toEqual([
      'Give the template a name (up to 80 characters).',
      'Give the letter a title for the letterhead (up to 60 characters).',
      'Write the letter (3 to 8,000 characters).'
    ]);
  });

  it('refuses a field nothing can fill and a field typed with one brace, before staff print blanks or braces', () => {
    const problems = checkLetterTemplate(draft({ body: 'Dear {patientName}, seen on {{visitDte}}.' }));
    expect(problems).toContain('{{visitDte}} is not a field a letter can fill. Pick fields from the list.');
    expect(problems).toContain('{patientName} needs two braces on each side, like {{patientName}}.');
  });
});

describe('listLetterProblem (a letter for everyone on a patient list)', () => {
  it('lets a recall letter through: everything it uses is on each patient file', () => {
    const recall = LETTER_TEMPLATE_EXAMPLES.find(example => example.kind === 'recall');
    expect(recall && listLetterProblem(recall)).toBeNull();
  });

  it('says why a template that needs a visit cannot be made for a list', () => {
    expect(listLetterProblem(draft())).toBe('It uses Visit date, which only a visit has. Use it from the visit instead.');
    expect(listLetterProblem(draft({ kind: 'sick_note', body: 'Unfit for {{daysOff}}.' }))).toBe(
      'A sick note belongs to a visit, so it cannot be made for a list.'
    );
  });

  it('never makes consent forms for a list: each patient signs their own on the screen', () => {
    expect(listLetterProblem(draft({ kind: 'consent', body: 'I consent to {{patientName}} being treated.' }))).toBe(
      'A consent form is signed by each patient on the screen, so it cannot be made for a list.'
    );
    // A typed procedure exists only when one form is made
    expect(listLetterProblem(draft({ body: 'Procedure: {{procedure}}.' }))).toMatch(/Procedure or treatment, which only a visit has/);
  });
});

describe('isLetterKind (what Write a letter and list letters offer)', () => {
  it('offers certificates, referral, recall and other letters, but not sick notes or consent forms, which have their own steps', () => {
    expect(['certificate', 'referral', 'recall', 'letter'].every(kind => isLetterKind(kind as LetterTemplateDraft['kind']))).toBe(true);
    expect(isLetterKind('sick_note')).toBe(false);
    expect(isLetterKind('consent')).toBe(false);
  });
});

describe('SMS and email templates', () => {
  it('ship examples that pass their checks', () => {
    for (const example of MESSAGE_TEMPLATE_EXAMPLES) expect(checkMessageTemplate(example)).toEqual([]);
  });

  it('need a subject for an email and keep an SMS to 4 SMS (each part is charged)', () => {
    expect(checkMessageTemplate({ name: 'Note', channel: 'email', category: 'custom', subject: '', body: 'Hello' })).toEqual(['Give the email a subject.']);
    const long = 'x'.repeat(153 * 4 + 1);
    expect(checkMessageTemplate({ name: 'Long', channel: 'sms', category: 'custom', subject: '', body: long })).toEqual([
      'An SMS template can be up to 4 SMS long. Shorten the message.'
    ]);
  });

  it('keep the diagnosis and ID number out of SMS and email templates', () => {
    expect(checkMessageTemplate({ name: 'Bad', channel: 'sms', category: 'health', subject: '', body: 'Your diagnosis: {{diagnosis}}' })).toEqual([
      '{{diagnosis}} is not a field a message can fill. Pick fields from the list.'
    ]);
  });

  it('let the roles change templates that the table policy lets change them', () => {
    expect(canChangeMessageTemplates({ role: 'receptionist' })).toBe(true);
    expect(canChangeMessageTemplates({ role: 'doctor' })).toBe(true);
    expect(canChangeMessageTemplates({ role: 'nurse' })).toBe(false);
    expect(canChangeMessageTemplates(null)).toBe(false);
  });
});
