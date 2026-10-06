// Google Gemini 1.5 Flash client — powers:
//   1) AI patient search (parses natural-language queries to structured filters)
//   2) Lab-result extraction from PDF/image uploads
//
// DEMO ONLY — this module reads VITE_GEMINI_API_KEY from import.meta.env, so the
// key ships to the browser. For production move these calls behind a Supabase
// Edge Function (which can hold the key in Functions secrets) and have the
// client invoke the edge function instead.

// Gemini 2.0 Flash — free tier, supports text + PDF + image inputs.
// Old `gemini-1.5-flash` was deprecated for the public v1beta endpoint.
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getApiKey(): string {
  const key = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set in .env');
  return key;
}

async function callGemini(body: unknown): Promise<any> {
  const key = getApiKey();
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function extractFirstJsonBlock(text: string): any {
  // Gemini sometimes wraps JSON in ```json fences or adds prose around it.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const startArr = candidate.indexOf('[');
  const firstBrace = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (firstBrace === -1) throw new Error('No JSON found in Gemini response');
  const slice = candidate.slice(firstBrace);
  return JSON.parse(slice);
}

/* ------------------------------------------------------------------ *
 * 1.  Patient search (text)                                          *
 * ------------------------------------------------------------------ */

export interface GeminiSearchPlan {
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

const SEARCH_SYSTEM_PROMPT = `You convert a clinician's natural-language patient query into a JSON search plan.

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

export async function geminiSearchPlan(query: string): Promise<GeminiSearchPlan> {
  const result = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SEARCH_SYSTEM_PROMPT}\n\nQuery: ${query}` }],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0,
    },
  });

  const text =
    result?.candidates?.[0]?.content?.parts?.[0]?.text ??
    JSON.stringify(result);
  const parsed = extractFirstJsonBlock(text);

  return {
    gender: parsed.gender ?? undefined,
    ageMin: parsed.ageMin ?? undefined,
    ageMax: parsed.ageMax ?? undefined,
    conditionKeywords: Array.isArray(parsed.conditionKeywords)
      ? parsed.conditionKeywords
      : [],
    visitedSinceDays: parsed.visitedSinceDays ?? undefined,
    withMedicalAid: parsed.withMedicalAid ?? undefined,
    noMedicalAid: parsed.noMedicalAid ?? undefined,
    freeTextKeywords: Array.isArray(parsed.freeTextKeywords)
      ? parsed.freeTextKeywords
      : [],
    description: parsed.description || query,
  };
}

/* ------------------------------------------------------------------ *
 * 2.  Lab-result extraction (multimodal: PDF + image)                *
 * ------------------------------------------------------------------ */

export interface ExtractedLabResult {
  testName: string;
  testValue: string;
  testUnit?: string;
  referenceRange?: string;
}

const LAB_EXTRACT_PROMPT = `You extract lab test results from a medical lab report (PDF or scanned image).

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

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as any
    );
  }
  return btoa(binary);
}

export async function geminiExtractLabResults(input: {
  fileUrl?: string;
  fileBlob?: Blob;
  mimeType: string;
}): Promise<{ results: ExtractedLabResult[] }> {
  let blob: Blob;
  if (input.fileBlob) {
    blob = input.fileBlob;
  } else if (input.fileUrl) {
    const res = await fetch(input.fileUrl);
    if (!res.ok) throw new Error(`Could not fetch file: ${res.status}`);
    blob = await res.blob();
  } else {
    throw new Error('Provide either fileUrl or fileBlob');
  }

  const base64 = await blobToBase64(blob);

  const result = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          { text: LAB_EXTRACT_PROMPT },
          {
            inline_data: {
              mime_type: input.mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0,
    },
  });

  const text =
    result?.candidates?.[0]?.content?.parts?.[0]?.text ??
    JSON.stringify(result);
  const parsed = extractFirstJsonBlock(text);

  const results: ExtractedLabResult[] = Array.isArray(parsed?.results)
    ? parsed.results
        .filter((r: any) => r?.testName && r?.testValue !== undefined)
        .map((r: any) => ({
          testName: String(r.testName),
          testValue: String(r.testValue),
          testUnit: r.testUnit ? String(r.testUnit) : undefined,
          referenceRange: r.referenceRange ? String(r.referenceRange) : undefined,
        }))
    : [];

  return { results };
}

export function isGeminiConfigured(): boolean {
  try {
    return !!getApiKey();
  } catch {
    return false;
  }
}
