/**
 * A pre-visit screening questionnaire (parity B17): the practice's own questions (Diary settings > Questions), answered
 * by the patient on the practice's tablet at check-in or through the booking's own link, which opens without signing
 * in. The database keeps the same rules (proposals/2026-10-13-previsit-questionnaire.sql: save_previsit_questionnaire,
 * previsit_clean_answers and the one function the link may call, previsit_questionnaire).
 */

export type PrevisitQuestionKind = 'yes_no' | 'text';

export interface PrevisitQuestion {
  /** Short and stable ('q1', 'fever'): answers are kept under it */
  id: string;
  text: string;
  kind: PrevisitQuestionKind;
  /** The patient must answer it */
  required: boolean;
}

/** A booking's answers: true or false for a yes/no question, words for the others; a question left out was skipped */
export type PrevisitAnswers = Record<string, boolean | string>;

/** Same limits as the database */
export const PREVISIT_QUESTIONS_MAX = 30;
export const PREVISIT_QUESTION_MAX = 200;
export const PREVISIT_ANSWER_MAX = 500;
export const PREVISIT_INTRO_MAX = 500;

export const PREVISIT_KINDS: ReadonlyArray<{ value: PrevisitQuestionKind; label: string }> = [
  { value: 'yes_no', label: 'Yes or no' },
  { value: 'text', label: 'In their own words' }
];

/**
 * Where the patient's link opens: the app's front page with #/q/<22-character code>. The host serves only the front
 * page for any address (a deeper address such as /q/... answers 404 there), and the part after # never reaches a web
 * server or its logs. /q/<code> is read too, for a host that serves the app on every address.
 */
export const PREVISIT_LINK_PATH = '/q/';
const PREVISIT_LINK_HASH = `#${PREVISIT_LINK_PATH}`;
const CODE = /^[A-Za-z0-9_-]{22}$/;
const QUESTION_ID = /^[a-z0-9]{1,12}$/;

/** Questions a practice can start from (nothing is saved until someone saves them). Plain, and not about one illness. */
export const EXAMPLE_PREVISIT_QUESTIONS: readonly PrevisitQuestion[] = [
  { id: 'unwell', text: 'Do you have a fever, cough or sore throat today?', kind: 'yes_no', required: true },
  { id: 'medicine', text: 'Have you started any new medicine since your last visit?', kind: 'yes_no', required: false },
  { id: 'allergy', text: 'Do you have an allergy we may not know about?', kind: 'yes_no', required: false },
  { id: 'reason', text: 'What would you like to talk about at this visit?', kind: 'text', required: false }
];

const text = (value: unknown): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** The questions as stored (previsit_questionnaires.questions), the unusable ones left out. */
export function normalizePrevisitQuestions(value: unknown): PrevisitQuestion[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const questions: PrevisitQuestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const questionText = text(row.text);
    const kind = row.kind === 'yes_no' || row.kind === 'text' ? row.kind : null;
    if (!QUESTION_ID.test(id) || seen.has(id) || !questionText || !kind) continue;
    seen.add(id);
    questions.push({ id, text: questionText, kind, required: row.required === true });
  }
  return questions;
}

/** A new question's id, not used by any other question: 'q1', 'q2', ... */
export function newPrevisitQuestionId(existing: readonly PrevisitQuestion[]): string {
  const used = new Set(existing.map((question) => question.id));
  for (let n = 1; ; n += 1) if (!used.has(`q${n}`)) return `q${n}`;
}

/** What stops the practice's questions from being saved, in plain words (the database checks the same). */
export function checkPrevisitQuestionnaire(draft: { intro: string; questions: readonly PrevisitQuestion[] }): string[] {
  const problems: string[] = [];
  if (draft.intro.trim().length > PREVISIT_INTRO_MAX) problems.push(`Keep the welcome line to ${PREVISIT_INTRO_MAX} characters.`);
  if (draft.questions.length > PREVISIT_QUESTIONS_MAX) problems.push(`Ask at most ${PREVISIT_QUESTIONS_MAX} questions.`);
  const ids = new Set<string>();
  draft.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!QUESTION_ID.test(question.id) || ids.has(question.id)) problems.push(`${label} needs its own short id.`);
    ids.add(question.id);
    const length = text(question.text).length;
    if (length === 0) problems.push(`${label} has no words.`);
    else if (length > PREVISIT_QUESTION_MAX) problems.push(`${label} is longer than ${PREVISIT_QUESTION_MAX} characters.`);
  });
  return problems;
}

export type PrevisitAnswersCheck = { ok: true; answers: PrevisitAnswers } | { ok: false; error: string };

/** Line breaks, tabs and other control characters: each run becomes one space (the database's [[:cntrl:]]+ rule) */
function withoutControlCharacters(value: string): string {
  let result = '';
  let inRun = false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) {
      if (!inRun) result += ' ';
      inRun = true;
    } else {
      result += character;
      inRun = false;
    }
  }
  return result;
}

/**
 * The answers kept: yes/no as true or false, words trimmed (up to PREVISIT_ANSWER_MAX; empty words are no answer),
 * questions not asked dropped, and every required question answered. The same rules as previsit_clean_answers.
 */
export function cleanPrevisitAnswers(questions: readonly PrevisitQuestion[], answers: Record<string, unknown>): PrevisitAnswersCheck {
  const clean: PrevisitAnswers = {};
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer !== undefined && answer !== null) {
      if (question.kind === 'yes_no') {
        if (typeof answer !== 'boolean') return { ok: false, error: `Answer yes or no to: ${question.text}` };
        clean[question.id] = answer;
      } else {
        if (typeof answer !== 'string') return { ok: false, error: `Write the answer to: ${question.text}` };
        const words = withoutControlCharacters(answer).trim();
        if (words.length > PREVISIT_ANSWER_MAX) return { ok: false, error: `Keep each answer to ${PREVISIT_ANSWER_MAX} characters` };
        if (words) clean[question.id] = words;
      }
    }
    if (question.required && !(question.id in clean)) return { ok: false, error: `Please answer: ${question.text}` };
  }
  return { ok: true, answers: clean };
}

/** The questions with their answers, as staff read them ("Yes", "No", the words, or "Not answered") */
export function previsitAnswerRows(
  questions: readonly PrevisitQuestion[],
  answers: Record<string, unknown>
): Array<{ id: string; question: string; answer: string; answered: boolean }> {
  return questions.map((question) => {
    const answer = answers[question.id];
    if (question.kind === 'yes_no' && typeof answer === 'boolean') return { id: question.id, question: question.text, answer: answer ? 'Yes' : 'No', answered: true };
    if (question.kind === 'text' && typeof answer === 'string' && answer.trim()) return { id: question.id, question: question.text, answer: answer.trim(), answered: true };
    return { id: question.id, question: question.text, answer: 'Not answered', answered: false };
  });
}

/** The booking's link: https://app.example.com/#/q/<code> */
export const previsitLink = (origin: string, code: string): string => `${origin.replace(/\/+$/, '')}/${PREVISIT_LINK_HASH}${code}`;

/** The address as the browser has it (window.location) */
export interface PrevisitLocation {
  pathname: string;
  hash: string;
}

/** True for the patient's link page (#/q/... or /q/...), which opens without signing in */
export const isPrevisitLocation = (location: PrevisitLocation): boolean =>
  location.hash.startsWith(PREVISIT_LINK_HASH) || location.pathname.startsWith(PREVISIT_LINK_PATH);

/** The code in /q/<code>, or null when the address is not a link a booking was given */
export function previsitCodeFromPath(pathname: string): string | null {
  const match = /^\/q\/([^/?#]+)\/?$/.exec(pathname);
  return match && CODE.test(match[1]) ? match[1] : null;
}

/** The code of the link the page was opened with (#/q/<code>, else /q/<code>), or null */
export function previsitCodeFromLocation(location: PrevisitLocation): string | null {
  if (location.hash.startsWith(PREVISIT_LINK_HASH)) return previsitCodeFromPath(location.hash.slice(1));
  return previsitCodeFromPath(location.pathname);
}

/** The SMS with the link: "Example Practice: Hi Maria, before your visit on Tue 14 Oct, please answer a few questions: <link>" */
export function previsitSmsText(input: { practiceName: string | null; firstName: string | null; when: string | null; link: string }): string {
  const practice = input.practiceName?.trim() || 'Your clinic';
  const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()}, ` : 'Hi, ';
  const before = input.when ? `before your visit on ${input.when}, ` : 'before your visit, ';
  return `${practice}: ${greeting}${before}please answer a few questions: ${input.link}`;
}
