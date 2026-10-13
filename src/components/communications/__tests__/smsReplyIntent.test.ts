import { describe, expect, it } from 'vitest';
import {
  FILLER_WORDS,
  interpretReply,
  REPLY_VOCABULARY,
  replyWords,
} from '../../../../supabase/functions/_shared/smsReplyIntent.ts';

// Namibian patients answer appointment reminders in English, Afrikaans or Oshiwambo, in any case, with
// emojis, punctuation and courtesy words. A clear one-word answer may change an appointment by itself;
// anything mixed must reach a person, because a wrong automatic cancel gives away a slot the patient
// still wants and a wrong confirm hides a patient who will not come.
describe('interpretReply: answers to an appointment reminder', () => {
  it.each(['1', 'YES', 'yes!!', 'Y', 'Confirm', 'Ja', 'ja dankie', 'Eeno', 'eeno tangi', 'Yes please \u{1F64F}', '\u{1F44D}', 'Ok thanks', '  YES.  '])(
    'reads %j as confirming the appointment',
    (text) => {
      expect(interpretReply(text, 'appointment').intent).toBe('confirm');
    }
  );

  it.each(['2', 'NO', 'no thanks', 'Cancel', 'cancel please', 'Nee', 'Aawe', 'kanselleer asseblief'])(
    'reads %j as cancelling the appointment',
    (text) => {
      expect(interpretReply(text, 'appointment').intent).toBe('cancel');
    }
  );

  it.each(['3', 'Reschedule', 'move it', 'Change', 'another time please', 'verskuif'])('reads %j as asking for a new time', (text) => {
    expect(interpretReply(text, 'appointment').intent).toBe('reschedule');
  });

  it.each([
    'yes but can we move it',
    'no problem',
    'ok cancel',
    'yes no',
    'I will be there at 10',
    'Can I come at 10:30?',
    'Not coming',
    'change my number',
  ])('sends %j to staff instead of acting on it', (text) => {
    expect(interpretReply(text, 'appointment').intent).toBe('free_text');
  });

  it('tells staff why a mixed reply was not handled automatically', () => {
    expect(interpretReply('yes but can we move it', 'appointment').reason).toMatch(/person should read it/);
    expect(interpretReply('ok cancel', 'appointment').reason).toMatch(/more than one instruction/);
  });
});

describe('interpretReply: words that work whatever message is answered', () => {
  it.each(['STOP', 'stop', 'Please stop sending me sms', 'opt out', 'Unsubscribe'])('%j opts the patient out of SMS', (text) => {
    expect(interpretReply(text, 'none').intent).toBe('opt_out');
  });

  it('does not opt out a patient who only mentions stopping something else', () => {
    expect(interpretReply('I want to stop my treatment', 'appointment').intent).toBe('free_text');
  });

  it('honours an opt-out SMSPortal recorded, whatever the text says', () => {
    expect(interpretReply('yes', 'appointment', { providerOptOut: true }).intent).toBe('opt_out');
  });

  it.each(['START', 'opt in'])('%j opts the patient back in', (text) => {
    expect(interpretReply(text, 'none').intent).toBe('opt_in');
  });

  it.each(['HELP', 'hulp'])('%j asks for help', (text) => {
    expect(interpretReply(text, 'none').intent).toBe('help');
  });

  it.each(['BOOK', 'book appointment', "Bespreek 'n afspraak"])('%j is a booking request, even with no earlier message', (text) => {
    expect(interpretReply(text, 'none').intent).toBe('booking');
  });
});

describe('interpretReply: the message being answered decides what a word means', () => {
  it('YES with no appointment message goes to staff: there is nothing to confirm', () => {
    expect(interpretReply('yes', 'none').intent).toBe('free_text');
  });

  it('a bare number goes to staff when the message did not ask for one', () => {
    const result = interpretReply('1', 'none');
    expect(result.intent).toBe('free_text');
    expect(result.reason).toMatch(/number/);
  });

  it('digits 1-5 answer a feedback request as a rating, never as a confirmation', () => {
    expect(interpretReply('1', 'feedback')).toMatchObject({ intent: 'rating', rating: 1 });
    expect(interpretReply('4/5', 'feedback')).toMatchObject({ intent: 'rating', rating: 4 });
    expect(interpretReply('5 stars', 'feedback')).toMatchObject({ intent: 'rating', rating: 5 });
    expect(interpretReply('6', 'feedback').intent).toBe('free_text');
  });

  it("YES to a waitlist offer accepts the slot and never confirms the other patient's visit", () => {
    expect(interpretReply('yes', 'waitlist_offer').intent).toBe('waitlist_accept');
    expect(interpretReply('no', 'waitlist_offer').intent).toBe('waitlist_decline');
  });
});

describe('the vocabulary', () => {
  it('reads past case, accents, punctuation, emojis and courtesy words', () => {
    expect(replyWords('Goeie môre Dr, JA!! \u{1F64F}')).toEqual(['ja']);
  });

  it('gives every word one meaning, and never treats a keyword as a courtesy word', () => {
    const words = Object.values(REPLY_VOCABULARY).flat();
    expect(new Set(words).size).toBe(words.length);
    expect(words.filter((word) => FILLER_WORDS.includes(word))).toEqual([]);
  });
});
