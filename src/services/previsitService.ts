/**
 * The pre-visit questionnaire (parity B17): the practice's questions, a booking's answers and its link
 * (proposals/2026-10-13-previsit-questionnaire.sql). The rules are in src/utils/clinical/previsitQuestions.ts. Staff
 * read the three tables and write through their functions; the patient's link page calls only previsit_questionnaire
 * (answerByLink, loadByLink). Before the SQL is applied the tables are missing: loads say 'not_set_up', the booking
 * shows nothing and Diary settings says the questions are not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { communicationService, getCommunicationErrorMessage } from './communicationService';
import { isMissingFunctionError, isMissingTableError, isPermissionError } from '../utils/diary/dbErrors';
import { normalizePrevisitQuestions, type PrevisitAnswers, type PrevisitQuestion } from '../utils/clinical/previsitQuestions';

// The new tables and functions are not in the generated database types yet: rows are read untyped and checked
const db = supabase as unknown as SupabaseClient;

export const PREVISIT_NOT_SET_UP_MESSAGE =
  'Questions before the visit are not set up yet. Your administrator needs to apply the diary update first.';

export interface PrevisitQuestionnaire {
  intro: string | null;
  questions: PrevisitQuestion[];
  updatedAt: string | null;
}

export type QuestionnaireLoad = { state: 'ready'; questionnaire: PrevisitQuestionnaire } | { state: 'not_set_up' } | { state: 'error'; message: string };

/** The practice's questions (none yet: an empty list). Never throws: a booking or a visit opens without them */
export const loadPrevisitQuestionnaire = (practiceId: string): Promise<QuestionnaireLoad> =>
  readPrevisitQuestionnaire(practiceId).catch((error: unknown): QuestionnaireLoad => {
    console.error('Could not load the questions before the visit:', error);
    return { state: 'error', message: 'Could not load the questions. Please try again.' };
  });

async function readPrevisitQuestionnaire(practiceId: string): Promise<QuestionnaireLoad> {
  const { data, error } = await db.from('previsit_questionnaires').select('intro, questions, updated_at').eq('practice_id', practiceId).maybeSingle();
  if (error) {
    if (isMissingTableError(error, 'previsit_questionnaires')) return { state: 'not_set_up' };
    console.error('Could not load the questions before the visit:', error);
    return { state: 'error', message: 'Could not load the questions. Please try again.' };
  }
  const row = (data ?? null) as { intro?: string | null; questions?: unknown; updated_at?: string | null } | null;
  return {
    state: 'ready',
    questionnaire: { intro: row?.intro ?? null, questions: normalizePrevisitQuestions(row?.questions), updatedAt: row?.updated_at ?? null }
  };
}

export type PrevisitWrite = { ok: true } | { ok: false; message: string; notSetUp?: boolean };

const PLAIN_REFUSALS = new Set(['22023', '23505', 'P0002']);

function refusal(error: { code?: string; message?: string } | null, functionName: string): { ok: false; message: string; notSetUp?: boolean } {
  if (isMissingFunctionError(error, functionName)) return { ok: false, notSetUp: true, message: PREVISIT_NOT_SET_UP_MESSAGE };
  if (isPermissionError(error) || PLAIN_REFUSALS.has(error?.code ?? '')) return { ok: false, message: error?.message || 'Not saved.' };
  console.error(`Could not save (${functionName}):`, error);
  return { ok: false, message: `Not saved: ${error?.message ?? 'unknown error'}` };
}

/** Saves the practice's questions (practice administrators and practitioners; the database checks the same). */
export async function savePrevisitQuestionnaire(practiceId: string, intro: string, questions: readonly PrevisitQuestion[]): Promise<PrevisitWrite> {
  const { error } = await db.rpc('save_previsit_questionnaire', {
    p_practice_id: practiceId,
    p_intro: intro.trim() || null,
    p_questions: questions.map((question) => ({ id: question.id, text: question.text.trim(), kind: question.kind, required: question.required }))
  });
  return error ? refusal(error, 'save_previsit_questionnaire') : { ok: true };
}

export interface PrevisitAnswerRecord {
  questions: PrevisitQuestion[];
  answers: Record<string, unknown>;
  via: 'tablet' | 'link';
  answeredAt: string;
}

export interface PrevisitLinkRecord {
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export type BookingPrevisitLoad =
  | { state: 'ready'; answers: PrevisitAnswerRecord | null; link: PrevisitLinkRecord | null }
  | { state: 'not_set_up' }
  | { state: 'error'; message: string };

/** A booking's answers (if any) and its latest link. Never throws: a booking or a visit opens without them */
export const loadBookingPrevisit = (visitId: string): Promise<BookingPrevisitLoad> =>
  readBookingPrevisit(visitId).catch((error: unknown): BookingPrevisitLoad => {
    console.error('Could not load the answers before the visit:', error);
    return { state: 'error', message: 'Could not load the answers. Please try again.' };
  });

async function readBookingPrevisit(visitId: string): Promise<BookingPrevisitLoad> {
  const [answers, links] = await Promise.all([
    db.from('previsit_answers').select('questions, answers, answered_via, answered_at').eq('visit_id', visitId).maybeSingle(),
    db.from('previsit_links').select('created_at, expires_at, used_at').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1)
  ]);
  const error = answers.error ?? links.error;
  if (error) {
    if (isMissingTableError(error, 'previsit_answers') || isMissingTableError(error, 'previsit_links')) return { state: 'not_set_up' };
    console.error('Could not load the answers before the visit:', error);
    return { state: 'error', message: 'Could not load the answers. Please try again.' };
  }
  const row = (answers.data ?? null) as { questions?: unknown; answers?: unknown; answered_via?: string; answered_at?: string } | null;
  const link = ((links.data ?? []) as Array<{ created_at: string; expires_at: string; used_at: string | null }>)[0];
  return {
    state: 'ready',
    answers:
      row && row.answered_at
        ? {
            questions: normalizePrevisitQuestions(row.questions),
            answers: row.answers && typeof row.answers === 'object' ? (row.answers as Record<string, unknown>) : {},
            via: row.answered_via === 'link' ? 'link' : 'tablet',
            answeredAt: row.answered_at
          }
        : null,
    link: link ? { createdAt: link.created_at, expiresAt: link.expires_at, usedAt: link.used_at } : null
  };
}

export type LinkCreate = { ok: true; code: string; expiresAt: string } | { ok: false; message: string; notSetUp?: boolean };

/** A new link code for the booking (shown once: the database keeps only its SHA-256); an earlier open link stops working */
export async function createPrevisitLink(visitId: string): Promise<LinkCreate> {
  const { data, error } = await db.rpc('create_previsit_link', { p_visit_id: visitId });
  if (error) return refusal(error, 'create_previsit_link');
  const result = (data ?? {}) as { token?: unknown; expires_at?: unknown };
  return typeof result.token === 'string' && typeof result.expires_at === 'string'
    ? { ok: true, code: result.token, expiresAt: result.expires_at }
    : { ok: false, message: 'The link could not be made. Please try again.' };
}

/** Answers given on the practice's tablet at check-in (once; the booking's open link stops working) */
export async function savePrevisitAnswersOnTablet(visitId: string, answers: PrevisitAnswers): Promise<PrevisitWrite> {
  const { error } = await db.rpc('save_previsit_answers', { p_visit_id: visitId, p_answers: answers });
  return error ? refusal(error, 'save_previsit_answers') : { ok: true };
}

/** Sends the booking's link by SMS through the practice's SMS gateway, after reception confirmed the number and the text */
export async function sendPrevisitLinkSms(request: {
  practiceId: string;
  patientId: string;
  visitId: string;
  phone: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await communicationService.sendSMS({
      practiceId: request.practiceId,
      recipientPhone: request.phone,
      messageContent: request.message,
      // A message staff send to one patient about their booking: also to a patient who replied STOP
      messageType: 'custom',
      patientId: request.patientId,
      visitId: request.visitId,
      metadata: { source: 'previsit_questionnaire' },
      tags: ['previsit_questionnaire']
    });
    return response.success ? { ok: true } : { ok: false, message: getCommunicationErrorMessage('sms', response.error) };
  } catch (error) {
    console.error('Could not send the questions link:', error);
    return { ok: false, message: 'Could not send the SMS. Check your connection and try again.' };
  }
}

// ---------------------------------------------------------------------------------------------------
// The patient's link page: the only call it makes is previsit_questionnaire
// ---------------------------------------------------------------------------------------------------

export type LinkPageState =
  | { status: 'open'; practiceName: string | null; intro: string | null; questions: PrevisitQuestion[] }
  | { status: 'saved' }
  | { status: 'answered' }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string };

function linkState(data: unknown, error: { code?: string; message?: string } | null): LinkPageState {
  if (error) {
    if (isMissingFunctionError(error, 'previsit_questionnaire')) return { status: 'error', message: 'This page is not ready yet. Please contact the practice.' };
    return { status: 'error', message: 'The page could not reach the practice. Check your connection and try again.' };
  }
  const result = (data ?? {}) as Record<string, unknown>;
  switch (result.status) {
    case 'open':
      return {
        status: 'open',
        practiceName: typeof result.practice_name === 'string' ? result.practice_name : null,
        intro: typeof result.intro === 'string' ? result.intro : null,
        questions: normalizePrevisitQuestions(result.questions)
      };
    case 'saved':
    case 'answered':
    case 'expired':
      return { status: result.status };
    case 'invalid':
      return { status: 'invalid', message: typeof result.message === 'string' ? result.message : 'Please check your answers.' };
    default:
      return { status: 'not_found' };
  }
}

/** The questions behind a link code (nothing else is reachable with it) */
export async function loadByLink(code: string): Promise<LinkPageState> {
  const { data, error } = await db.rpc('previsit_questionnaire', { p_token: code, p_answers: null });
  return linkState(data, error);
}

/** Sends the patient's answers through the link (kept once) */
export async function answerByLink(code: string, answers: PrevisitAnswers): Promise<LinkPageState> {
  const { data, error } = await db.rpc('previsit_questionnaire', { p_token: code, p_answers: answers });
  return linkState(data, error);
}
