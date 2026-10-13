import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Patient } from '../stores/patientsStoreNew';
import { usePractice } from '../contexts/PracticeContext';
import { supabase } from '../lib/supabase';
import { runFallbackSearch, applyParsedFilters, ParsedQuery } from '../lib/aiSearchFallback';
import { geminiSearchPlan, isGeminiConfigured } from '../lib/geminiClient';

export interface AiSearchResult {
  success: boolean;
  patientIds?: string[];
  count?: number;
  description?: string;
  searchQuery?: string;
  confidence?: number;
  error?: string;
  timestamp: string;
  logs?: string[];
}

export const useAiPatientSearch = (
  patients: Patient[],
  setCurrentPage: (page: number) => void
) => {
  const { practiceId } = usePractice();
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [searchDescription, setSearchDescription] = useState<string>('');
  const [aiFilteredPatients, setAiFilteredPatients] = useState<Patient[] | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');
  const [searchLogs, setSearchLogs] = useState<string[]>([]);

  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim() || isAiSearching) return;

    console.log('🔍 AI Search initiated:', query);
    setIsAiSearching(true);
    setLastSearchQuery(query);
    setSearchLogs([]);

    // Path A — Gemini Flash (multilingual, handles complex phrasing)
    if (isGeminiConfigured()) {
      try {
        console.log('✨ Calling Gemini 1.5 Flash for query plan');
        const plan = await geminiSearchPlan(query);
        console.log('📋 Gemini plan:', plan);

        const parsed: ParsedQuery = {
          gender: plan.gender,
          ageMin: plan.ageMin,
          ageMax: plan.ageMax,
          conditionKeywords: plan.conditionKeywords,
          visitedSinceDays: plan.visitedSinceDays,
          withMedicalAid: plan.withMedicalAid,
          noMedicalAid: plan.noMedicalAid,
          description: plan.description,
        };

        const fallbackTerm = plan.freeTextKeywords?.join(' ') || query;
        const out = await applyParsedFilters(parsed, patients, practiceId, fallbackTerm);

        const filteredPatients = patients.filter(p => out.patientIds.includes(p.id));
        setAiFilteredPatients(filteredPatients);
        setSearchDescription(out.description);
        setCurrentPage(1);
        setSearchLogs([`Gemini plan: ${plan.description}`]);

        if (filteredPatients.length === 0) {
          toast(`No patients matched "${out.description}"`, { icon: '🔍' });
        } else {
          toast.success(
            `Found ${filteredPatients.length} patient${filteredPatients.length === 1 ? '' : 's'}: ${out.description}`
          );
        }
        setIsAiSearching(false);
        return;
      } catch (geminiErr: any) {
        console.warn('⚠️ Gemini failed, falling back to local parser:', geminiErr?.message);
      }
    }

    // Path B — local parser fallback (handles common patterns without any LLM)
    try {
      const fallback = await runFallbackSearch(query, patients, practiceId);
      const filteredPatients = patients.filter(p => fallback.patientIds.includes(p.id));
      setAiFilteredPatients(filteredPatients);
      setSearchDescription(fallback.description);
      setCurrentPage(1);

      if (filteredPatients.length === 0) {
        toast(`No patients matched "${fallback.description}"`, { icon: '🔍' });
      } else {
        toast.success(
          `Found ${filteredPatients.length} patient${filteredPatients.length === 1 ? '' : 's'} (${fallback.description})`
        );
      }
    } catch (error: any) {
      console.error('❌ AI search failed entirely:', error);
      // The reason stays in the console; staff need to know the search did not run, not the database's wording
      toast.error('The search could not be completed. Please check the connection and try again.');
      setAiFilteredPatients(null);
      setSearchDescription('');
    } finally {
      setIsAiSearching(false);
    }
  }, [isAiSearching, patients, practiceId, setCurrentPage]);

  const clearAiSearch = useCallback(() => {
    setAiFilteredPatients(null);
    setSearchDescription('');
    setLastSearchQuery('');
    setSearchLogs([]);
  }, []);

  return {
    isAiSearching,
    searchDescription,
    aiFilteredPatients,
    lastSearchQuery,
    searchPatients,
    clearAiSearch,
    searchLogs
  };
};