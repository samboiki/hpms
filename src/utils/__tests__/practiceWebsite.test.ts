/**
 * Documents (statements, patient letters) print the practice's website. The website a practice types in
 * Settings > Practice must be the one printed; the OneHealth domain is only the fallback.
 */
import { describe, expect, it } from 'vitest';
import { practiceWebsiteText, practiceWebsiteUrl } from '../practiceWebsite';

describe('practiceWebsiteText', () => {
  it('prints the website the practice typed, without the https:// a reader does not need', () => {
    expect(practiceWebsiteText({ website_url: 'https://www.example-clinic.test/', domain: 'example.test' }))
      .toBe('www.example-clinic.test');
  });

  it('falls back to the domain (once "www.") and to nothing', () => {
    expect(practiceWebsiteText({ website_url: '', domain: 'example.test' })).toBe('www.example.test');
    expect(practiceWebsiteText({ domain: 'www.example.test' })).toBe('www.example.test');
    expect(practiceWebsiteText({ website_url: null, domain: null })).toBe('');
    expect(practiceWebsiteUrl(null)).toBeNull();
  });

  it('gives a link for emails', () => {
    expect(practiceWebsiteUrl({ website_url: 'example-clinic.test' })).toBe('https://example-clinic.test');
  });
});
