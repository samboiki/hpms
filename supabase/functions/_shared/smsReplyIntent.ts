/**
 * What does a patient want, from the text of an SMS reply? Pure TypeScript (no Deno APIs), used by
 * the sms-reply-webhook edge function and unit tested with Vitest.
 *
 * Safety rule: only a reply that is clearly one instruction becomes an automatic action. Anything
 * mixed ("yes but can we move it", "no problem", "ok cancel") goes to staff as free text.
 * Words are read in the context of the message being answered: "1" confirms an appointment
 * reminder but is a rating for a feedback request, and YES without an appointment message means
 * nothing on its own.
 */
import type { SmsReplyContext } from './smsMessagePolicy.ts';

export type SmsReplyIntent =
  | 'confirm'
  | 'cancel'
  | 'reschedule'
  | 'booking'
  | 'opt_out'
  | 'opt_in'
  | 'help'
  | 'rating'
  | 'waitlist_accept'
  | 'waitlist_decline'
  | 'free_text';

/** Every intent. The practice_sms_replies.intent check constraint lists the same values. */
export const SMS_REPLY_INTENTS: readonly SmsReplyIntent[] = [
  'confirm',
  'cancel',
  'reschedule',
  'booking',
  'opt_out',
  'opt_in',
  'help',
  'rating',
  'waitlist_accept',
  'waitlist_decline',
  'free_text',
];

export type ReplyKeyword = 'yes' | 'no' | 'reschedule' | 'book' | 'stop' | 'start' | 'help';

/**
 * The reply vocabulary: English, Afrikaans and Oshiwambo. This is the one place to add words.
 * Matching ignores case, accents, punctuation and emojis ("YES!!", "Ja.", "eeno 🙏").
 */
export const REPLY_VOCABULARY: Readonly<Record<ReplyKeyword, readonly string[]>> = {
  // ja = Afrikaans, eeno = Oshiwambo
  yes: ['yes', 'y', 'yeah', 'yea', 'ya', 'yah', 'yep', 'yup', 'ok', 'okay', 'okey', 'sure', 'confirm', 'confirmed', 'ja', 'jaa', 'eeno'],
  // nee, kanselleer = Afrikaans, aawe = Oshiwambo
  no: ['no', 'n', 'nope', 'nah', 'cancel', 'nee', 'kanselleer', 'aawe'],
  // verskuif, verander = Afrikaans
  reschedule: ['reschedule', 'resched', 'move', 'change', 'postpone', 'verskuif', 'verander'],
  // bespreek = Afrikaans
  book: ['book', 'booking', 'bespreek'],
  stop: ['stop', 'optout', 'unsubscribe', 'unsub', 'stopall'],
  start: ['start', 'optin', 'subscribe', 'unstop'],
  // hulp = Afrikaans
  help: ['help', 'hulp', 'info'],
};

/** Two-word phrases read as one word before matching. */
const PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ opt out /g, ' optout '],
  [/ opt in /g, ' optin '],
  [/ (?:new|another|other|different) (?:time|day|date) /g, ' reschedule '],
  [/ ander (?:tyd|dag|datum) /g, ' reschedule '], // Afrikaans: another time / day / date
];

/** Courtesy and context words that never change what a reply means ("Yes please", "Ja dankie"). */
export const FILLER_WORDS: readonly string[] = [
  'please', 'pls', 'plz', 'plse', 'thanks', 'thank', 'you', 'u', 'thx', 'tx', 'ty', 'tnx',
  'dankie', 'baie', 'asb', 'asseblief', // Afrikaans: thank you, very, please
  'tangi', 'unene', // Oshiwambo: thank you (very much)
  'hi', 'hello', 'hallo', 'hey', 'good', 'morning', 'afternoon', 'evening', 'goeie', 'more', 'middag', 'naand',
  'sir', 'madam', 'maam', 'mam', 'doc', 'dr', 'doctor', 'nurse',
  'i', 'my', 'the', 'it', 'a', 'an', 'option',
  'appointment', 'appointments', 'appt', 'afspraak', 'star', 'stars',
];

/** Words that may follow STOP without making it unclear ("please stop sending me sms"). */
export const STOP_CONTEXT_WORDS: readonly string[] = [
  'sending', 'send', 'me', 'messages', 'message', 'msgs', 'msg', 'sms', 'smses', 'smss',
  'text', 'texts', 'texting', 'all', 'now', 'these', 'this', 'them',
];

const FILLERS = new Set(FILLER_WORDS);
const STOP_CONTEXT = new Set(STOP_CONTEXT_WORDS);
const KEYWORD_OF = new Map<string, ReplyKeyword>();
for (const keyword of Object.keys(REPLY_VOCABULARY) as ReplyKeyword[]) {
  for (const word of REPLY_VOCABULARY[keyword]) KEYWORD_OF.set(word, keyword);
}

// A thumbs up (any skin tone) is a YES; every other emoji is ignored
const THUMBS_UP = /\u{1F44D}[\u{1F3FB}-\u{1F3FF}]?/gu;
// "4/5", "4 out of 5", "4 uit 5" (Afrikaans) in answer to a feedback request
const RATING_FRACTION = /\b([1-5])\s*(?:\/|out of|uit)\s*5\b/g;

/** The words of a reply that carry meaning: lower case, no accents, punctuation or courtesy words. */
export function replyWords(text: string | null | undefined, context: SmsReplyContext = 'none'): string[] {
  let s = (text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(THUMBS_UP, ' yes ').toLowerCase();
  if (context === 'feedback') s = s.replace(RATING_FRACTION, ' $1 ');
  s = s.replace(/['‘’]n\b/g, ' '); // Afrikaans article 'n ("bespreek 'n afspraak"), not N for no
  s = s.replace(/['‘’`]/g, ''); // don't -> dont, so it is one (unknown) word
  s = ` ${s.replace(/[^a-z0-9]+/g, ' ').trim()} `;
  for (const [pattern, word] of PHRASES) s = s.replace(pattern, word);
  return s.split(' ').filter((word) => word !== '' && !FILLERS.has(word));
}

type Meaning = ReplyKeyword | `rating:${number}`;

const APPOINTMENT_DIGITS: Readonly<Record<string, ReplyKeyword>> = { '1': 'yes', '2': 'no', '3': 'reschedule' };
const WAITLIST_DIGITS: Readonly<Record<string, ReplyKeyword>> = { '1': 'yes', '2': 'no' };

function meaningOf(word: string, context: SmsReplyContext): Meaning | null {
  const keyword = KEYWORD_OF.get(word);
  if (keyword) return keyword;
  if (!/^\d$/.test(word)) return null;
  if (context === 'feedback') return Number(word) >= 1 && Number(word) <= 5 ? `rating:${Number(word)}` : null;
  if (context === 'appointment') return APPOINTMENT_DIGITS[word] ?? null;
  if (context === 'waitlist_offer') return WAITLIST_DIGITS[word] ?? null;
  return null; // a bare number answers nothing when the message did not ask a question
}

export interface ReplyInterpretation {
  intent: SmsReplyIntent;
  /** 1-5 for a rating, otherwise null */
  rating: number | null;
  /** Plain-language explanation, shown to staff (especially when a person must read the reply). */
  reason: string;
}

const result = (intent: SmsReplyIntent, reason: string, rating: number | null = null): ReplyInterpretation => ({
  intent,
  rating,
  reason,
});

export interface InterpretOptions {
  /** SMSPortal flagged the reply as an opt-out (it matched the account's opt-out phrase). */
  providerOptOut?: boolean;
}

/** Work out what a reply asks for, in the context of the message it answers. */
export function interpretReply(
  text: string | null | undefined,
  context: SmsReplyContext,
  options: InterpretOptions = {}
): ReplyInterpretation {
  if (options.providerOptOut) return result('opt_out', 'SMSPortal recorded this reply as an opt-out.');

  const words = replyWords(text, context);
  if (words.length === 0) return result('free_text', 'There is no instruction in the reply.');

  const meanings = words.map((word) => meaningOf(word, context));
  const unknownWords = words.filter((_, index) => meanings[index] === null);
  const distinct = [...new Set(meanings.filter((meaning): meaning is Meaning => meaning !== null))];

  // STOP is honoured even in a short sentence ("please stop sending me sms")
  if (distinct.length === 1 && distinct[0] === 'stop' && unknownWords.every((word) => STOP_CONTEXT.has(word))) {
    return result('opt_out', 'Asked to stop SMS messages.');
  }
  if (distinct.length === 0) {
    return result(
      'free_text',
      /^\d+$/.test(words.join('')) && context !== 'feedback'
        ? 'The reply is a number, but the message it answers did not ask for one.'
        : 'The reply has no keyword the system acts on.'
    );
  }
  if (unknownWords.length > 0) {
    return result('free_text', 'The reply mixes a keyword with other words, so a person should read it.');
  }
  if (distinct.length > 1) return result('free_text', 'The reply contains more than one instruction.');

  const meaning = distinct[0];
  if (meaning.startsWith('rating:')) {
    const rating = Number(meaning.slice('rating:'.length));
    return result('rating', `Rated the visit ${rating} out of 5.`, rating);
  }

  switch (meaning as ReplyKeyword) {
    case 'stop':
      return result('opt_out', 'Asked to stop SMS messages.');
    case 'start':
      return result('opt_in', 'Asked to receive SMS messages again.');
    case 'help':
      return result('help', 'Asked for help.');
    case 'book':
      return result('booking', 'Asked to book an appointment.');
    case 'reschedule':
      return result('reschedule', 'Asked for a new appointment time.');
    case 'yes':
      if (context === 'appointment') return result('confirm', 'Answered YES to the appointment message.');
      if (context === 'waitlist_offer') return result('waitlist_accept', 'Accepted the offered appointment slot.');
      return result('free_text', 'Answered YES, but the message it answers is not about an appointment.');
    case 'no':
      if (context === 'appointment') return result('cancel', 'Answered NO / cancel to the appointment message.');
      if (context === 'waitlist_offer') return result('waitlist_decline', 'Declined the offered appointment slot.');
      return result('free_text', 'Answered NO, but the message it answers is not about an appointment.');
  }
  return result('free_text', 'The reply has no keyword the system acts on.');
}
