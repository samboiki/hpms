/**
 * Saving templates: letter templates only through the database function that checks the role (its plain-word answers
 * reach staff as they are); SMS and email templates keep their text in every column the readers use, and a removed
 * template is switched off, never deleted. No real database in tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));

import { LetterTemplatesNotSetUpError, archiveLetterTemplate, loadLetterTemplates, loadSickNoteTemplate, saveLetterTemplate } from '../letterTemplatesService';
import { loadMessageTemplates, removeMessageTemplate, saveMessageTemplate } from '../messageTemplatesService';

/** A thenable query that resolves to `result` whatever filters are chained, recording the calls */
const query = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'in']) chain[name] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;
};

afterEach(() => {
  supabaseMock.from.mockReset();
  supabaseMock.rpc.mockReset();
});

const draft = {
  kind: 'certificate' as const,
  name: 'Fit to return to work',
  title: 'MEDICAL CERTIFICATE',
  recipient: '',
  subject: 'Re: {{patientName}}',
  greeting: 'To whom it may concern',
  body: 'Fit to return on {{returnDate}}.'
};

describe('letter templates', () => {
  it('are saved through save_letter_template with every part, so the database checks the role and the text', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'template-1', error: null });
    expect(await saveLetterTemplate('practice-1', draft, null)).toBe('template-1');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('save_letter_template', {
      p_practice_id: 'practice-1',
      p_template_id: null,
      p_kind: 'certificate',
      p_name: 'Fit to return to work',
      p_title: 'MEDICAL CERTIFICATE',
      p_recipient: '',
      p_subject: 'Re: {{patientName}}',
      p_greeting: 'To whom it may concern',
      p_body: 'Fit to return on {{returnDate}}.'
    });
  });

  it("pass on the database's plain-word refusal, and say who may change them", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'Another letter template is already called Fit to return to work.' } });
    await expect(saveLetterTemplate('practice-1', draft, null)).rejects.toThrow('Another letter template is already called Fit to return to work.');
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only the practice administrators...' } });
    await expect(archiveLetterTemplate('template-1')).rejects.toThrow('Only a practice administrator can change letter templates.');
  });

  it('say "not set up yet" before the letter templates update, and the sick note keeps its usual wording', async () => {
    const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.letter_templates' in the schema cache" } };
    supabaseMock.from.mockReturnValue(query(missing));
    await expect(loadLetterTemplates('practice-1')).rejects.toBeInstanceOf(LetterTemplatesNotSetUpError);
    expect(await loadSickNoteTemplate('practice-1')).toBeNull();
  });

  it('read only the templates in use, a stored unknown kind read as an other letter', async () => {
    const read = query({ data: [{ id: 't1', kind: 'mystery', name: 'Old', title: 'LETTER', recipient: null, subject: null, greeting: null, body: 'Text', updated_at: null }], error: null });
    supabaseMock.from.mockReturnValue(read);
    const templates = await loadLetterTemplates('practice-1');
    expect(read.eq).toHaveBeenCalledWith('is_active', true);
    expect(templates[0]).toMatchObject({ kind: 'letter', recipient: '', subject: '', greeting: '' });
  });
});

describe('SMS and email templates', () => {
  const message = { name: 'Results ready', channel: 'sms' as const, category: 'health' as const, subject: 'ignored for SMS', body: ' Hi {{patientFirstName}}, your results are ready. ' };

  it('keep the text in body, text_content and content, so the Message window and the gateways read the same words', async () => {
    const insert = query({ data: [{ id: 'm1', name: 'Results ready', type: 'sms', channel: 'sms', category: 'health', subject: null, body: 'Hi', updated_at: null }], error: null });
    supabaseMock.from.mockReturnValue(insert);
    await saveMessageTemplate('practice-1', message, null);
    const values = insert.insert.mock.calls[0][0];
    expect(values).toMatchObject({
      practice_id: 'practice-1',
      type: 'sms',
      channel: 'sms',
      category: 'health',
      subject: null,
      body: 'Hi {{patientFirstName}}, your results are ready.',
      text_content: 'Hi {{patientFirstName}}, your results are ready.',
      content: 'Hi {{patientFirstName}}, your results are ready.',
      is_active: true
    });
  });

  it('are switched off when removed (never deleted), and a role the policy refuses is told so', async () => {
    const update = query({ data: [{ id: 'm1' }], error: null });
    supabaseMock.from.mockReturnValue(update);
    await removeMessageTemplate('practice-1', 'm1');
    expect(update.update.mock.calls[0][0]).toMatchObject({ is_active: false });
    // The policy hides a row the user may not change: nothing comes back
    supabaseMock.from.mockReturnValue(query({ data: [], error: null }));
    await expect(removeMessageTemplate('practice-1', 'm1')).rejects.toThrow('Your role cannot change SMS and email templates.');
  });

  it('read an older template saved without a channel by its type', async () => {
    supabaseMock.from.mockReturnValue(query({ data: [{ id: 'm2', name: 'Old email', type: 'email', channel: null, category: null, subject: 'Hello', body: null, text_content: 'Hi {{patientName}}', updated_at: null }], error: null }));
    const [template] = await loadMessageTemplates('practice-1');
    expect(template).toMatchObject({ channel: 'email', category: 'custom', body: 'Hi {{patientName}}' });
  });
});
