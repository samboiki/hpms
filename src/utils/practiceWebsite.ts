/**
 * The practice's website as printed on its documents. Settings > Practice saves the website the practice types into
 * practices.website_url; documents used to print only practices.domain (set by OneHealth), so a practice's own website
 * never appeared. The typed website wins; the domain is the fallback.
 */
export function practiceWebsiteText(practice: { website_url?: string | null; domain?: string | null } | null | undefined): string {
  const typed = (practice?.website_url ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (typed) return typed;
  const domain = (practice?.domain ?? '').trim();
  if (!domain) return '';
  return /^www\./i.test(domain) ? domain : `www.${domain}`;
}

/** The same website as a link ("https://..."), or null when the practice has none */
export function practiceWebsiteUrl(practice: { website_url?: string | null; domain?: string | null } | null | undefined): string | null {
  const text = practiceWebsiteText(practice);
  return text ? `https://${text}` : null;
}
