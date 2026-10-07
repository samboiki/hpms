import { describe, it, expect } from 'vitest';
import {
  buildGeminiBody,
  extractFirstJsonBlock,
  MAX_FILE_BYTES,
  MAX_QUERY_CHARS,
  parseLabResults,
  parseSearchPlan,
  validateAiAssistRequest
} from '../aiAssist';

const geminiReply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

// The server holds the key and the prompts, so the browser can only ask the two questions staff need,
// within limits, and never use the key as a general AI endpoint.
describe('validateAiAssistRequest', () => {
  it('accepts a patient search and trims it', () => {
    expect(validateAiAssistRequest({ task: 'search-plan', query: '  women over 50 with diabetes ' })).toEqual({
      ok: true,
      request: { task: 'search-plan', query: 'women over 50 with diabetes' }
    });
  });

  it('refuses tasks other than search and lab reading, so the key cannot be used for anything else', () => {
    expect(validateAiAssistRequest({ task: 'chat', prompt: 'write me a poem' })).toMatchObject({ ok: false });
    expect(validateAiAssistRequest(null)).toMatchObject({ ok: false });
  });

  it('refuses empty and over-long searches with a plain reason', () => {
    expect(validateAiAssistRequest({ task: 'search-plan', query: '   ' })).toMatchObject({ ok: false, error: 'Type what you are looking for.' });
    expect(validateAiAssistRequest({ task: 'search-plan', query: 'x'.repeat(MAX_QUERY_CHARS + 1) })).toMatchObject({ ok: false });
  });

  it('accepts lab reports as PDFs and photos only', () => {
    expect(validateAiAssistRequest({ task: 'lab-extract', mimeType: 'application/pdf', dataBase64: 'JVBERi0x' })).toMatchObject({ ok: true });
    expect(validateAiAssistRequest({ task: 'lab-extract', mimeType: 'IMAGE/JPEG', dataBase64: 'AAAA' })).toMatchObject({ ok: true });
    expect(validateAiAssistRequest({ task: 'lab-extract', mimeType: 'application/zip', dataBase64: 'AAAA' })).toMatchObject({ ok: false });
  });

  it('refuses files over 8 MB and data that is not base64', () => {
    const tooBig = 'A'.repeat(Math.ceil(((MAX_FILE_BYTES + 3) * 4) / 3));
    expect(validateAiAssistRequest({ task: 'lab-extract', mimeType: 'image/png', dataBase64: tooBig })).toMatchObject({ ok: false });
    expect(validateAiAssistRequest({ task: 'lab-extract', mimeType: 'image/png', dataBase64: 'not base64!' })).toMatchObject({ ok: false });
  });
});

describe('buildGeminiBody', () => {
  it('sends the document inline with the extraction prompt and asks for JSON at temperature 0', () => {
    const body = buildGeminiBody({ task: 'lab-extract', mimeType: 'application/pdf', dataBase64: 'JVBERi0x' }) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
      generationConfig: Record<string, unknown>;
    };
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'application/pdf', data: 'JVBERi0x' } });
    expect(body.generationConfig).toEqual({ response_mime_type: 'application/json', temperature: 0 });
  });
});

describe('parsing the AI reply', () => {
  it('reads JSON even when the AI wraps it in a code fence or prose', () => {
    expect(extractFirstJsonBlock('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractFirstJsonBlock('Result: {"a":2}')).toEqual({ a: 2 });
  });

  it('keeps only valid search fields, so a bad reply cannot inject odd filters', () => {
    const plan = parseSearchPlan(geminiReply('{"gender":"woman","ageMin":"50","conditionKeywords":["diabetes",3],"freeTextKeywords":null,"description":""}'), 'women over 50');
    expect(plan).toEqual({
      gender: undefined,
      ageMin: undefined,
      ageMax: undefined,
      conditionKeywords: ['diabetes'],
      visitedSinceDays: undefined,
      withMedicalAid: undefined,
      noMedicalAid: undefined,
      freeTextKeywords: [],
      description: 'women over 50'
    });
  });

  it('keeps every lab row that has a name and a value, as text, and drops the rest', () => {
    const rows = parseLabResults(geminiReply('{"results":[{"testName":"HbA1c","testValue":6.8,"testUnit":"%","referenceRange":"<5.7"},{"testName":"","testValue":"1"},{"testValue":"2"}]}'));
    expect(rows).toEqual([{ testName: 'HbA1c', testValue: '6.8', testUnit: '%', referenceRange: '<5.7' }]);
  });

  it('returns no rows when the report has no results', () => {
    expect(parseLabResults(geminiReply('{"results":[]}'))).toEqual([]);
  });
});
