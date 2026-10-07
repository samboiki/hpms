// AI assist (Gemini): the prompts, input limits and response cleaning used by the ai-assist edge function.
// Pure TypeScript with no Deno APIs, so it is unit tested with Vitest. The browser never sees the API key or the
// prompts: it sends only the user's query or the lab document, and gets cleaned JSON back.

export const MAX_QUERY_CHARS = 500;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const LAB_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const;

export interface SearchPlan {
  gender?: 'male' | 'female';
  ageMin?: number;
  ageMax?: number;
  conditionKeywords: string[];
  visitedSinceDays?: number;
  withMedicalAid?: boolean;
  noMedicalAid?: boolean;
  freeTextKeywords: string[];
  description: string;
}

export interface LabResultRow {
  testName: string;
  testValue: string;
  testUnit?: string;
  referenceRange?: string;
}

export type AiAssistRequest =
  | { task: 'search-plan'; query: string }
  | { task: 'lab-extract'; mimeType: (typeof LAB_MIME_TYPES)[number]; dataBase64: string };

export const SEARCH_SYSTEM_PROMPT = `You convert a clinician's natural-language patient query into a JSON search plan.

Return ONLY raw JSON (no prose, no code fence) matching this TypeScript type:
{
  "gender": "male" | "female" | null,
  "ageMin": number | null,           // inclusive lower bound on age in years
  "ageMax": number | null,           // inclusive upper bound on age in years
  "conditionKeywords": string[],     // medical conditions/diagnoses to match
  "visitedSinceDays": number | null, // patients visited in last N days
  "withMedicalAid": boolean | null,  // true if user specified WITH medical aid
  "noMedicalAid": boolean | null,    // true if user specified NO medical aid
  "freeTextKeywords": string[],      // any remaining keywords for name/email/id fallback
  "description": string              // one-line human-readable summary
}

Rules:
- "over 50" → ageMin: 50; "under 18" → ageMax: 17; "aged 20 to 40" → ageMin:20, ageMax:40.
- "women|female|she|ladies" → gender:"female".
- "men|male|he|guys" → gender:"male".
- "last month" → visitedSinceDays:30; "last week" → 7; "last 90 days" → 90.
- "with diabetes" → conditionKeywords:["diabetes"]. Use lowercase singular forms.
- Leave fields null if the query doesn't mention them.
- description should be terse like "female, age ≥ 50, with diabetes".`;

export const LAB_EXTRACT_PROMPT = `You extract lab test results from a medical lab report (PDF or scanned image).

Return ONLY raw JSON (no prose, no code fence). Shape:
{
  "results": [
    {
      "testName": string,        // e.g. "Hemoglobin", "Fasting Glucose"
      "testValue": string,       // numeric or qualitative value as printed
      "testUnit": string | null, // e.g. "g/dL", "mmol/L", "%"
      "referenceRange": string | null // e.g. "12.0-16.0", "<5.7"
    }
  ]
}

Rules:
- Extract EVERY test row visible — do not summarise.
- Use the exact text for testValue (don't reformat numbers).
- Skip header/footer metadata (patient name, date, doctor) — only the test rows.
- If a test has no unit or range, set those fields to null.
- If no test data is visible, return {"results": []}.`;

/** Checks a request from the browser; returns a plain-language reason when it cannot be used */
export function validateAiAssistRequest(body: unknown): { ok: true; request: AiAssistRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Send a JSON body with a task.' };
  const input = body as Record<string, unknown>;
  if (input.task === 'search-plan') {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    if (!query) return { ok: false, error: 'Type what you are looking for.' };
    if (query.length > MAX_QUERY_CHARS) return { ok: false, error: `Keep the search under ${MAX_QUERY_CHARS} characters.` };
    return { ok: true, request: { task: 'search-plan', query } };
  }
  if (input.task === 'lab-extract') {
    const mimeType = String(input.mimeType ?? '').toLowerCase();
    if (!(LAB_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return { ok: false, error: 'Upload the lab report as a PDF or a photo (PNG, JPEG, WEBP or HEIC).' };
    }
    const dataBase64 = typeof input.dataBase64 === 'string' ? input.dataBase64 : '';
    if (!dataBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) return { ok: false, error: 'The file could not be read. Try uploading it again.' };
    if (Math.floor((dataBase64.length * 3) / 4) > MAX_FILE_BYTES) return { ok: false, error: 'The file is larger than 8 MB. Upload a smaller scan or photo.' };
    return { ok: true, request: { task: 'lab-extract', mimeType: mimeType as (typeof LAB_MIME_TYPES)[number], dataBase64 } };
  }
  return { ok: false, error: 'Unknown task.' };
}

/** The Gemini generateContent body for a request (temperature 0, JSON output) */
export function buildGeminiBody(request: AiAssistRequest): Record<string, unknown> {
  const parts = request.task === 'search-plan'
    ? [{ text: `${SEARCH_SYSTEM_PROMPT}\n\nQuery: ${request.query}` }]
    : [{ text: LAB_EXTRACT_PROMPT }, { inline_data: { mime_type: request.mimeType, data: request.dataBase64 } }];
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0 }
  };
}

/** Gemini sometimes wraps JSON in ```json fences or adds prose around it */
export function extractFirstJsonBlock(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : text;
  const brace = candidate.indexOf('{');
  const bracket = candidate.indexOf('[');
  const first = brace === -1 ? bracket : bracket === -1 ? brace : Math.min(brace, bracket);
  if (first === -1) throw new Error('No JSON found in the AI response');
  return JSON.parse(candidate.slice(first));
}

const responseText = (geminiResponse: unknown): string => {
  const text = (geminiResponse as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : JSON.stringify(geminiResponse);
};

const asStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
const asNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const asBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

export function parseSearchPlan(geminiResponse: unknown, query: string): SearchPlan {
  const parsed = extractFirstJsonBlock(responseText(geminiResponse)) as Record<string, unknown>;
  const gender = parsed.gender === 'male' || parsed.gender === 'female' ? parsed.gender : undefined;
  return {
    gender,
    ageMin: asNumber(parsed.ageMin),
    ageMax: asNumber(parsed.ageMax),
    conditionKeywords: asStringArray(parsed.conditionKeywords),
    visitedSinceDays: asNumber(parsed.visitedSinceDays),
    withMedicalAid: asBoolean(parsed.withMedicalAid),
    noMedicalAid: asBoolean(parsed.noMedicalAid),
    freeTextKeywords: asStringArray(parsed.freeTextKeywords),
    description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description : query
  };
}

export function parseLabResults(geminiResponse: unknown): LabResultRow[] {
  const parsed = extractFirstJsonBlock(responseText(geminiResponse)) as { results?: unknown };
  if (!Array.isArray(parsed?.results)) return [];
  return parsed.results
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !!(row as Record<string, unknown>).testName && (row as Record<string, unknown>).testValue !== undefined)
    .map((row) => ({
      testName: String(row.testName),
      testValue: String(row.testValue),
      testUnit: row.testUnit ? String(row.testUnit) : undefined,
      referenceRange: row.referenceRange ? String(row.referenceRange) : undefined
    }));
}
