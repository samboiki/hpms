// Advanced search utilities for patient search functionality

import { Patient } from '../stores/patientsStoreNew';

interface SearchOptions {
  threshold?: number; // Fuzzy match threshold (0 = exact, 1 = match anything)
  includeScore?: boolean;
  minMatchCharLength?: number;
  keys?: string[]; // Fields to search
}

// Simple fuzzy search implementation
export function fuzzyMatch(pattern: string, text: string): number {
  const patternLength = pattern.length;
  const textLength = text.length;
  
  if (patternLength > textLength) {
    return 0;
  }
  
  if (patternLength === textLength) {
    return pattern === text ? 1 : 0;
  }
  
  let matchedChars = 0;
  let patternIndex = 0;
  
  for (let textIndex = 0; textIndex < textLength && patternIndex < patternLength; textIndex++) {
    if (pattern[patternIndex].toLowerCase() === text[textIndex].toLowerCase()) {
      matchedChars++;
      patternIndex++;
    }
  }
  
  return matchedChars / patternLength;
}

// Calculate Levenshtein distance for more accurate fuzzy matching
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  const n = str1.length;
  const m = str2.length;

  if (n === 0) return m;
  if (m === 0) return n;

  for (let i = 0; i <= m; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[m][n];
}

// Normalize string for better matching
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Extract search tokens (words) from query
export function extractTokens(query: string): string[] {
  return normalizeString(query)
    .split(' ')
    .filter(token => token.length > 0);
}

// Calculate relevance score for a patient based on search query
export function calculateRelevanceScore(
  patient: Patient,
  query: string,
  options: SearchOptions = {}
): number {
  const {
    threshold = 0.3,
    minMatchCharLength = 2,
    keys = ['first_name', 'last_name', 'email', 'cell_number', 'id_number']
  } = options;

  if (query.length < minMatchCharLength) return 0;

  const queryTokens = extractTokens(query);
  let totalScore = 0;
  let matchedFields = 0;

  // Check each searchable field
  for (const key of keys) {
    const fieldValue = patient[key as keyof Patient];
    if (!fieldValue || typeof fieldValue !== 'string') continue;

    const normalizedField = normalizeString(fieldValue);
    let fieldScore = 0;

    // Exact match gets highest score
    if (normalizedField.includes(normalizeString(query))) {
      fieldScore = 1;
    } else {
      // Check token matches
      for (const token of queryTokens) {
        if (normalizedField.includes(token)) {
          fieldScore += 0.8 / queryTokens.length;
        } else {
          // Fuzzy match
          const fuzzyScore = fuzzyMatch(token, normalizedField);
          if (fuzzyScore >= threshold) {
            fieldScore += fuzzyScore * 0.5 / queryTokens.length;
          }
        }
      }
    }

    // Boost score for certain fields
    if (key === 'first_name' || key === 'last_name') {
      fieldScore *= 1.5;
    } else if (key === 'cell_number' || key === 'id_number') {
      fieldScore *= 1.2;
    }

    if (fieldScore > 0) {
      totalScore += fieldScore;
      matchedFields++;
    }
  }

  // Normalize score based on matched fields
  return matchedFields > 0 ? totalScore / matchedFields : 0;
}

// Smart search with ranking
export function smartSearchPatients(
  patients: Patient[],
  query: string,
  options: SearchOptions = {}
): Array<{ patient: Patient; score: number }> {
  if (!query || query.trim().length === 0) {
    return patients.map(patient => ({ patient, score: 1 }));
  }

  const results: Array<{ patient: Patient; score: number }> = [];

  for (const patient of patients) {
    const score = calculateRelevanceScore(patient, query, options);
    if (score > 0) {
      results.push({ patient, score });
    }
  }

  // Sort by relevance score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

// Parse natural language queries
export function parseNaturalQuery(query: string): {
  searchTerms: string[];
  filters: Record<string, any>;
} {
  const lowerQuery = query.toLowerCase();
  const filters: Record<string, any> = {};
  let searchTerms = query;

  // Extract gender
  if (lowerQuery.includes('female') || lowerQuery.includes('woman') || lowerQuery.includes('women')) {
    filters.gender = 'female';
    searchTerms = searchTerms.replace(/\b(female|woman|women)\b/gi, '');
  } else if (lowerQuery.includes('male') || lowerQuery.includes('man') || lowerQuery.includes('men')) {
    filters.gender = 'male';
    searchTerms = searchTerms.replace(/\b(male|man|men)\b/gi, '');
  }

  // Extract age ranges
  const ageMatch = lowerQuery.match(/\b(\d+)\s*(year|yr|years|yrs)\s*(old)?\b/i);
  if (ageMatch) {
    filters.age = parseInt(ageMatch[1]);
    searchTerms = searchTerms.replace(ageMatch[0], '');
  }

  const ageRangeMatch = lowerQuery.match(/\b(over|above|under|below)\s*(\d+)\b/i);
  if (ageRangeMatch) {
    const operator = ageRangeMatch[1].toLowerCase();
    const age = parseInt(ageRangeMatch[2]);
    filters.ageOperator = operator === 'over' || operator === 'above' ? '>' : '<';
    filters.ageThreshold = age;
    searchTerms = searchTerms.replace(ageRangeMatch[0], '');
  }

  // Extract medical aid status
  if (lowerQuery.includes('insured') || lowerQuery.includes('medical aid')) {
    filters.hasInsurance = true;
    searchTerms = searchTerms.replace(/\b(insured|medical aid)\b/gi, '');
  }

  // Clean up search terms
  searchTerms = searchTerms.trim().replace(/\s+/g, ' ');

  return {
    searchTerms: extractTokens(searchTerms),
    filters
  };
}

// Apply parsed filters to patients
export function applyFilters(
  patients: Patient[],
  filters: Record<string, any>
): Patient[] {
  return patients.filter(patient => {
    // Gender filter
    if (filters.gender && patient.gender?.toLowerCase() !== filters.gender) {
      return false;
    }

    // Age filters
    if (patient.date_of_birth) {
      const age = calculateAge(patient.date_of_birth);
      
      if (filters.age && age !== filters.age) {
        return false;
      }
      
      if (filters.ageOperator && filters.ageThreshold) {
        if (filters.ageOperator === '>' && age <= filters.ageThreshold) {
          return false;
        }
        if (filters.ageOperator === '<' && age >= filters.ageThreshold) {
          return false;
        }
      }
    }

    // Insurance filter
    if (filters.hasInsurance && !patient.medical_aid_details) {
      return false;
    }

    return true;
  });
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Comprehensive search function
export function comprehensiveSearch(
  patients: Patient[],
  query: string,
  options: SearchOptions = {}
): Patient[] {
  // Parse the query
  const { searchTerms, filters } = parseNaturalQuery(query);
  
  // Apply filters first
  let filteredPatients = applyFilters(patients, filters);
  
  // If there are search terms, apply smart search
  if (searchTerms.length > 0) {
    const searchQuery = searchTerms.join(' ');
    const searchResults = smartSearchPatients(filteredPatients, searchQuery, options);
    
    // Return only patients with a minimum score
    const minScore = 0.1;
    filteredPatients = searchResults
      .filter(result => result.score >= minScore)
      .map(result => result.patient);
  }
  
  return filteredPatients;
}

// Highlight matching text
export function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  
  const regex = new RegExp(`(${query.split(' ').join('|')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 text-gray-900">$1</mark>');
}