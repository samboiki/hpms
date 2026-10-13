import { describe, it, expect } from 'vitest';
import { WIRED_AUTOMATION_IDS } from '../../../../supabase/functions/process-automation-queue/automationRules';
import { AUTOMATION_CARDS, cardsForView, isCardOn, type AutomationLiveState } from '../automationCatalog';

const state = (overrides: Partial<AutomationLiveState> = {}): AutomationLiveState => ({
  setUp: true,
  enabledIds: new Set<string>(),
  diaryRemindersOn: false,
  ...overrides
});

// Everything switched on in the database, including rows the old screen saved for cards nothing runs
const everythingSaved = new Set(AUTOMATION_CARDS.map((card) => card.id));

describe('a card that is not wired can never look switched on', () => {
  // The owner's first rule: no setting that does nothing. Before 2026-10-08 about 20 cards looked on while only one
  // had anything behind it
  it('cards nothing sends are never on, whatever the practice saved', () => {
    for (const card of AUTOMATION_CARDS.filter((c) => c.kind === 'not_offered')) {
      expect(isCardOn(card, state({ enabledIds: everythingSaved, diaryRemindersOn: true }))).toBe(false);
    }
  });

  it('and are left out of the default "Active" view', () => {
    const active = cardsForView('active', state({ enabledIds: everythingSaved, diaryRemindersOn: true }));
    expect(active.some((card) => card.kind === 'not_offered')).toBe(false);
    // ...but still listed under "All", clearly marked, so nobody thinks the feature was forgotten
    expect(cardsForView('all', state()).filter((card) => card.kind === 'not_offered').length).toBeGreaterThan(0);
  });

  // An old saved row (birthday-wishes, appointment-reminder) must not make a card look on: its job runs elsewhere
  it('a card whose job runs elsewhere is on only when that place is verifiably on', () => {
    const birthdays = AUTOMATION_CARDS.find((card) => card.id === 'birthday-wishes');
    const reminders = AUTOMATION_CARDS.find((card) => card.id === 'appointment-reminder');
    expect(birthdays && isCardOn(birthdays, state({ enabledIds: everythingSaved }))).toBe(false);
    expect(reminders && isCardOn(reminders, state({ enabledIds: everythingSaved }))).toBe(false);
    expect(reminders && isCardOn(reminders, state({ diaryRemindersOn: true }))).toBe(true);
  });

  // Before the database part is applied nothing would send, so even a switched-on automation is not shown as on
  it('a sending automation is on only once the engine is set up and the practice switched it on', () => {
    const welcome = AUTOMATION_CARDS.find((card) => card.id === 'welcome-new-patient');
    if (!welcome) throw new Error('welcome card missing');
    expect(isCardOn(welcome, state({ setUp: false, enabledIds: new Set(['welcome-new-patient']) }))).toBe(false);
    expect(isCardOn(welcome, state({ enabledIds: new Set() }))).toBe(false);
    expect(isCardOn(welcome, state({ enabledIds: new Set(['welcome-new-patient']) }))).toBe(true);
  });
});

describe('every card says what it really is', () => {
  // A switch only where the sender handles the automation: one engine, and the same ids as the SQL
  it('exactly the automations the sender handles have a switch', () => {
    expect(AUTOMATION_CARDS.filter((card) => card.kind === 'sends').map((card) => card.id).sort()).toEqual([...WIRED_AUTOMATION_IDS].sort());
  });

  // "Done elsewhere" is only honest if the card takes people there
  it('a card whose job is done elsewhere names the place and opens it', () => {
    for (const card of AUTOMATION_CARDS) {
      if (card.kind !== 'elsewhere') continue;
      expect(card.target.label).toMatch(/^Open /);
      if (card.target.kind === 'lists') expect(card.summary).toContain(`"${card.target.list}"`);
      else expect(card.target.href.startsWith('/')).toBe(true);
    }
  });

  it('keeps one card per id, with the ids the old screen saved', () => {
    const ids = AUTOMATION_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('appointment-reminder');
    expect(ids).toContain('transactions-import');
  });

  // The old cards showed invented figures ("15,420 sent, 98.7%"); figures now come only from the queue
  it('holds no figures of its own', () => {
    for (const card of AUTOMATION_CARDS) {
      expect(card).not.toHaveProperty('stats');
      expect(`${card.name} ${card.summary}`).not.toMatch(/\d+(\.\d+)?%/);
    }
  });
});
