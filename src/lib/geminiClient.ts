// Google Gemini, through the ai-assist edge function — powers:
//   1) AI patient search (parses natural-language queries to structured filters)
//   2) Lab-result extraction from PDF/image uploads
//
// The Gemini key and the prompts live on the server (supabase/functions/ai-assist, secret GEMINI_API_KEY);
// this module only sends the user's query or the document. Turn the AI buttons on with VITE_AI_ASSIST_ENABLED=true
// once the secret is set. The function's prompts, limits and parsing are in supabase/functions/_shared/aiAssist.ts.
import { supabase } from './supabase';

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

export interface ExtractedLabResult {
  testName: string;
  testValue: string;
  testUnit?: string;
  referenceRange?: string;
}

/** Calls the ai-assist function and turns its { error } replies into readable errors */
async function invokeAiAssist<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body });
  if (error) {
    let message = error.message;
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      try {
        const reply = await response.json();
        if (reply && typeof reply.error === 'string') message = reply.error;
      } catch {
        // Keep the generic message
      }
    }
    throw new Error(message);
  }
  return data as T;
}

/* ------------------------------------------------------------------ *
 * 1.  Patient search (text)                                          *
 * ------------------------------------------------------------------ */

export async function geminiSearchPlan(query: string): Promise<GeminiSearchPlan> {
  const { plan } = await invokeAiAssist<{ plan: GeminiSearchPlan }>({ task: 'search-plan', query });
  return {
    ...plan,
    conditionKeywords: plan?.conditionKeywords ?? [],
    freeTextKeywords: plan?.freeTextKeywords ?? [],
    description: plan?.description || query
  };
}

/* ------------------------------------------------------------------ *
 * 2.  Lab-result extraction (multimodal: PDF + image)                *
 * ------------------------------------------------------------------ */

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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

  const { results } = await invokeAiAssist<{ results: ExtractedLabResult[] }>({
    task: 'lab-extract',
    mimeType: input.mimeType,
    dataBase64: await blobToBase64(blob)
  });
  return { results: Array.isArray(results) ? results : [] };
}

/** Shows the AI buttons only once the practice has switched AI reading on (the key itself is on the server) */
export function isGeminiConfigured(): boolean {
  return import.meta.env.VITE_AI_ASSIST_ENABLED === 'true';
}
