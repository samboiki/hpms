import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkPrevisitQuestionnaire,
  cleanPrevisitAnswers,
  EXAMPLE_PREVISIT_QUESTIONS,
  isPrevisitLocation,
  newPrevisitQuestionId,
  normalizePrevisitQuestions,
  PREVISIT_ANSWER_MAX,
  previsitAnswerRows,
  previsitCodeFromLocation,
  previsitCodeFromPath,
  previsitLink,
  previsitSmsText,
  type PrevisitQuestion
} from '../previsitQuestions';

const SQL = readFileSync('proposals/2026-10-13-previsit-questionnaire.sql', 'utf8');
const CODE = 'Ab3_-xY9Ab3_-xY9Ab3_-x'; // 22 URL-safe characters, invented

const QUESTIONS: PrevisitQuestion[] = [
  { id: 'unwell', text: 'Do you have a fever today?', kind: 'yes_no', required: true },
  { id: 'reason', text: 'What would you like to talk about?', kind: 'text', required: false }
];

// The tablet and the link page check the answers before sending them; previsit_clean_answers checks them again and
// keeps what it returns. If the two disagreed a patient would be told an answer is fine and then refused, or the
// reverse.
describe('answers are cleaned the same way on the screen and in the database', () => {
  it('uses the database limit for an answer', () => {
    expect(SQL).toContain(`char_length(v_text) > ${PREVISIT_ANSWER_MAX}`);
  });

  it('keeps yes/no as true or false and words trimmed, with line breaks and tabs as single spaces', () => {
    expect(cleanPrevisitAnswers(QUESTIONS, { unwell: false, reason: '  my knee\r\n\thurts  ' })).toEqual({
      ok: true,
      answers: { unwell: false, reason: 'my knee hurts' }
    });
  });

  it('treats empty words as no answer, and refuses to keep a booking without a required answer', () => {
    expect(cleanPrevisitAnswers(QUESTIONS, { unwell: true, reason: ' \n ' })).toEqual({ ok: true, answers: { unwell: true } });
    expect(cleanPrevisitAnswers(QUESTIONS, { reason: 'my knee' })).toEqual({ ok: false, error: 'Please answer: Do you have a fever today?' });
  });

  it('refuses an answer of the wrong kind instead of guessing what the patient meant', () => {
    expect(cleanPrevisitAnswers(QUESTIONS, { unwell: 'yes' })).toEqual({ ok: false, error: 'Answer yes or no to: Do you have a fever today?' });
    expect(cleanPrevisitAnswers(QUESTIONS, { unwell: true, reason: 5 })).toEqual({ ok: false, error: 'Write the answer to: What would you like to talk about?' });
    expect(cleanPrevisitAnswers(QUESTIONS, { unwell: true, reason: 'x'.repeat(PREVISIT_ANSWER_MAX + 1) }).ok).toBe(false);
  });

  it('drops answers to questions the practice did not ask, so a link cannot store anything else', () => {
    expect(cleanPrevisitAnswers(QUESTIONS, { unwell: true, injected: 'anything' })).toEqual({ ok: true, answers: { unwell: true } });
  });
});

describe('the practice\'s questions', () => {
  it('reads only usable questions from what is stored, each id once', () => {
    const stored = [
      { id: 'q1', text: '  Any  pain? ', kind: 'yes_no', required: true },
      { id: 'q1', text: 'A second q1', kind: 'text' },
      { id: 'Bad Id', text: 'Not a short id', kind: 'text' },
      { id: 'q2', text: '', kind: 'text' },
      { id: 'q3', text: 'Unknown kind', kind: 'scale' },
      'not a question'
    ];
    expect(normalizePrevisitQuestions(stored)).toEqual([{ id: 'q1', text: 'Any pain?', kind: 'yes_no', required: true }]);
    expect(normalizePrevisitQuestions(null)).toEqual([]);
  });

  it('gives a new question an id no other question has, so earlier answers never move to it', () => {
    expect(newPrevisitQuestionId([{ ...QUESTIONS[0], id: 'q1' }, { ...QUESTIONS[1], id: 'q3' }])).toBe('q2');
  });

  it('starts from example questions that pass the same checks as a practice\'s own', () => {
    expect(checkPrevisitQuestionnaire({ intro: '', questions: EXAMPLE_PREVISIT_QUESTIONS })).toEqual([]);
    expect(checkPrevisitQuestionnaire({ intro: '', questions: [{ ...QUESTIONS[0], text: '  ' }] })).toEqual(['Question 1 has no words.']);
  });

  it('shows staff every question, answered or not', () => {
    expect(previsitAnswerRows(QUESTIONS, { unwell: true })).toEqual([
      { id: 'unwell', question: 'Do you have a fever today?', answer: 'Yes', answered: true },
      { id: 'reason', question: 'What would you like to talk about?', answer: 'Not answered', answered: false }
    ]);
  });
});

// The link opens without signing in: only an address of exactly /q/<22-character code> may reach the database
// function, and that function is the one thing the public key can run
describe('the patient\'s link', () => {
  // The host serves only the app's front page (a deeper address answers 404), and what follows # never reaches a
  // web server or its logs: the link is the front page with the code after #
  it('opens the front page with the code after #, and reads the same code back', () => {
    const link = previsitLink('https://app.example.com/', CODE);
    expect(link).toBe(`https://app.example.com/#/q/${CODE}`);
    const url = new URL(link);
    expect(url.pathname).toBe('/');
    expect(previsitCodeFromLocation(url)).toBe(CODE);
    expect(isPrevisitLocation(url)).toBe(true);
    expect(isPrevisitLocation({ pathname: '/patients', hash: '' })).toBe(false);
  });

  it('also reads a code from /q/<code>, for a host that serves the app on every address', () => {
    expect(previsitCodeFromLocation({ pathname: `/q/${CODE}`, hash: '' })).toBe(CODE);
    expect(isPrevisitLocation({ pathname: `/q/${CODE}`, hash: '' })).toBe(true);
    expect(previsitCodeFromLocation({ pathname: '/', hash: '#/patients' })).toBeNull();
  });

  it('does not take a code that is too short, too long, or has other characters', () => {
    expect(previsitCodeFromPath(`/q/${CODE.slice(1)}`)).toBeNull();
    expect(previsitCodeFromPath(`/q/${CODE}x`)).toBeNull();
    expect(previsitCodeFromPath(`/q/${CODE.slice(1)}%`)).toBeNull();
    expect(previsitCodeFromPath(`/q/${CODE}/more`)).toBeNull();
  });

  it('is the only function the public key may run, and it checks the code shape itself', () => {
    const statements = SQL.replace(/--.*$/gm, '').split(';').map((statement) => statement.replace(/\s+/g, ' ').trim());
    const anonGrants = statements.filter((statement) => /^GRANT\b/.test(statement) && /\banon\b/.test(statement));
    expect(anonGrants).toEqual(['GRANT EXECUTE ON FUNCTION public.previsit_questionnaire(text, jsonb) TO anon, authenticated, service_role']);
    expect(SQL).toContain("p_token !~ '^[A-Za-z0-9_-]{22}$'");
    // Only a hash of the code is kept, so a copy of the table opens no questionnaire
    expect(SQL).toContain("token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')");
  });

  it('says who sends it and when the visit is, without saying why the patient is coming', () => {
    expect(previsitSmsText({ practiceName: 'Example Practice', firstName: 'Maria', when: 'Tue 14 Oct', link: `https://app.example.com/#/q/${CODE}` })).toBe(
      `Example Practice: Hi Maria, before your visit on Tue 14 Oct, please answer a few questions: https://app.example.com/#/q/${CODE}`
    );
    expect(previsitSmsText({ practiceName: null, firstName: null, when: null, link: 'L' })).toBe('Your clinic: Hi, before your visit, please answer a few questions: L');
  });
});
