// Free, zero-dependency natural-language patient search fallback.
// Activates when the Supabase Edge Function (OpenAI-backed) fails.
// Handles: gender, age range, chronic conditions (via visits/medications),
// recent-visit windows, and "with/no medical aid".

import { supabase } from './supabase';
import { Patient } from '../stores/patientsStoreNew';

export interface ParsedQuery {
  gender?: 'male' | 'female';
  ageMin?: number;
  ageMax?: number;
  conditionKeywords: string[];
  visitedSinceDays?: number;
  withMedicalAid?: boolean;
  noMedicalAid?: boolean;
  description: string;
}

const CONDITION_WORDS = [
  'diabetes', 'diabetic', 'hypertension', 'hypertensive', 'high blood pressure',
  'asthma', 'asthmatic', 'hiv', 'aids', 'tb', 'tuberculosis',
  'cancer', 'cardiac', 'heart', 'cholesterol', 'arthritis',
  'kidney', 'renal', 'liver', 'hepatitis', 'covid',
  'stroke', 'epilepsy', 'depression', 'anxiety',
  'pregnancy', 'pregnant', 'obesity', 'obese',
  'allergy', 'allergic', 'thyroid', 'anemia', 'migraine',
];

export function parseQuery(raw: string): ParsedQuery {
  const q = raw.toLowerCase();
  const parts: string[] = [];
  const parsed: ParsedQuery = { conditionKeywords: [], description: '' };

  // Gender
  if (/\b(women|woman|female|girl|she|her|ladies|lady)\b/.test(q)) {
    parsed.gender = 'female';
    parts.push('female');
  } else if (/\b(men|man|male|boy|he|him|guys)\b/.test(q) &&
             !/\b(women|woman|female)\b/.test(q)) {
    parsed.gender = 'male';
    parts.push('male');
  }

  // Age — "over 50", "above 50", "older than 50", "50 and older", "50+"
  const overMatch = q.match(/(?:over|above|older than|>=?)\s*(\d{1,3})\b/) ||
                    q.match(/(\d{1,3})\s*(?:\+|\s+and\s+older|\s+or\s+older)/);
  if (overMatch) {
    parsed.ageMin = parseInt(overMatch[1], 10);
    parts.push(`age ≥ ${parsed.ageMin}`);
  }

  // Age — "under 30", "below 30", "younger than 30"
  const underMatch = q.match(/(?:under|below|younger than|<=?)\s*(\d{1,3})\b/);
  if (underMatch) {
    parsed.ageMax = parseInt(underMatch[1], 10);
    parts.push(`age < ${parsed.ageMax}`);
  }

  // Age range — "aged 20 to 40" / "between 20 and 40"
  const rangeMatch = q.match(/(?:aged?|between)\s*(\d{1,3})\s*(?:to|and|-)\s*(\d{1,3})/);
  if (rangeMatch) {
    parsed.ageMin = parseInt(rangeMatch[1], 10);
    parsed.ageMax = parseInt(rangeMatch[2], 10);
    parts.push(`age ${parsed.ageMin}–${parsed.ageMax}`);
  }

  // Chronic conditions
  for (const word of CONDITION_WORDS) {
    if (q.includes(word)) {
      parsed.conditionKeywords.push(word);
    }
  }
  if (parsed.conditionKeywords.length > 0) {
    parts.push(`with ${parsed.conditionKeywords.join('/')}`);
  }

  // Recent visits
  if (/\b(last|this|past)\s+week\b/.test(q) || /\bthis week\b/.test(q)) {
    parsed.visitedSinceDays = 7;
    parts.push('visited in last week');
  } else if (/\b(last|this|past)\s+month\b/.test(q) || /\brecent(ly)?\b/.test(q)) {
    parsed.visitedSinceDays = 30;
    parts.push('visited in last month');
  } else if (/\b(last|this|past)\s+(\d{1,3})\s+days?\b/.test(q)) {
    const m = q.match(/(\d{1,3})\s+days?/);
    if (m) {
      parsed.visitedSinceDays = parseInt(m[1], 10);
      parts.push(`visited in last ${parsed.visitedSinceDays} days`);
    }
  }

  // Medical aid
  if (/\bno medical aid\b|\buninsured\b/.test(q)) {
    parsed.noMedicalAid = true;
    parts.push('no medical aid');
  } else if (/\bwith medical aid\b|\binsured\b/.test(q)) {
    parsed.withMedicalAid = true;
    parts.push('with medical aid');
  }

  parsed.description = parts.length > 0
    ? parts.join(', ')
    : `keyword search: ${raw}`;

  return parsed;
}

function calculateAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export async function applyParsedFilters(
  parsed: ParsedQuery,
  patients: Patient[],
  practiceId: string | null,
  rawQueryForFallback: string = '',
): Promise<{ patientIds: string[]; description: string }> {
  let candidates = [...patients];

  // 1. Gender filter
  if (parsed.gender) {
    candidates = candidates.filter(p =>
      p.gender && p.gender.toLowerCase().startsWith(parsed.gender!.charAt(0))
    );
  }

  // 2. Age filter
  if (parsed.ageMin !== undefined || parsed.ageMax !== undefined) {
    candidates = candidates.filter(p => {
      const age = calculateAge(p.date_of_birth);
      if (age === null) return false;
      if (parsed.ageMin !== undefined && age < parsed.ageMin) return false;
      if (parsed.ageMax !== undefined && age > parsed.ageMax) return false;
      return true;
    });
  }

  // 3. Medical aid filter
  if (parsed.noMedicalAid) {
    candidates = candidates.filter(p =>
      !p.medical_aid_details || p.medical_aid_details.length === 0
    );
  } else if (parsed.withMedicalAid) {
    candidates = candidates.filter(p =>
      p.medical_aid_details && p.medical_aid_details.length > 0
    );
  }

  // 4. Condition filter — query visits.diagnosis / treatment_plan / chief_complaint
  //    and medications.medication_name for any condition keyword.
  if (parsed.conditionKeywords.length > 0 && practiceId && candidates.length > 0) {
    const candidateIds = candidates.map(c => c.id);
    const orFilter = parsed.conditionKeywords
      .map(kw => [
        `diagnosis.ilike.%${kw}%`,
        `treatment_plan.ilike.%${kw}%`,
        `chief_complaint.ilike.%${kw}%`,
        `notes.ilike.%${kw}%`,
      ].join(','))
      .join(',');

    const { data: matchedVisits, error: visitsError } = await supabase
      .from('visits')
      .select('patient_id')
      .in('patient_id', candidateIds)
      .or(orFilter);

    let matchedPatientIds = new Set<string>(
      (matchedVisits ?? []).map(v => v.patient_id).filter(Boolean)
    );

    // Also check medications
    const medOrFilter = parsed.conditionKeywords
      .map(kw => `medication_name.ilike.%${kw}%`)
      .join(',');
    const { data: matchedMeds } = await supabase
      .from('medications')
      .select('patient_id')
      .in('patient_id', candidateIds)
      .or(medOrFilter);
    for (const m of matchedMeds ?? []) {
      if (m.patient_id) matchedPatientIds.add(m.patient_id);
    }

    if (visitsError) {
      console.warn('[aiSearchFallback] visits filter error:', visitsError.message);
    }

    candidates = candidates.filter(c => matchedPatientIds.has(c.id));
  }

  // 5. Recent-visit window — patients whose latest visit is within N days
  if (parsed.visitedSinceDays !== undefined && candidates.length > 0) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - parsed.visitedSinceDays);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    const candidateIds = candidates.map(c => c.id);
    const { data: recentVisits } = await supabase
      .from('visits')
      .select('patient_id')
      .in('patient_id', candidateIds)
      .gte('visit_date', sinceStr);

    const recentIds = new Set<string>(
      (recentVisits ?? []).map(v => v.patient_id).filter(Boolean)
    );
    candidates = candidates.filter(c => recentIds.has(c.id));
  }

  // 6. Final keyword fallback — if NOTHING parsed structurally, do an OR over
  //    first_name/last_name/cell_number/id_number/email
  const usedStructural =
    parsed.gender !== undefined ||
    parsed.ageMin !== undefined ||
    parsed.ageMax !== undefined ||
    parsed.conditionKeywords.length > 0 ||
    parsed.visitedSinceDays !== undefined ||
    parsed.noMedicalAid ||
    parsed.withMedicalAid;

  if (!usedStructural && rawQueryForFallback) {
    const term = rawQueryForFallback.trim().toLowerCase();
    candidates = candidates.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(term) ||
      (p.email?.toLowerCase().includes(term) ?? false) ||
      (p.cell_number?.includes(term) ?? false) ||
      (p.id_number?.includes(term) ?? false) ||
      (p.occupation?.toLowerCase().includes(term) ?? false)
    );
  }

  return {
    patientIds: candidates.map(c => c.id),
    description: parsed.description,
  };
}

export async function runFallbackSearch(
  rawQuery: string,
  patients: Patient[],
  practiceId: string | null,
): Promise<{ patientIds: string[]; description: string; matchedFilters: string[] }> {
  const parsed = parseQuery(rawQuery);
  const out = await applyParsedFilters(parsed, patients, practiceId, rawQuery);
  return { ...out, matchedFilters: out.description.split(', ') };
}
