import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Patient } from '../stores/patientsStoreNew';
import { usePractice } from '../contexts/PracticeContext';
import { supabase } from '../lib/supabase';

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
    
    console.log('🔍 AI Search via Supabase Edge Function initiated with query:', query);
    setIsAiSearching(true);
    setLastSearchQuery(query);
    setSearchLogs([]);
    
    try {
      // Generate a session ID for tracking
      const sessionId = crypto.randomUUID();
      
      console.log('📡 Calling Supabase Edge Function: ai-patient-search');
      
      const { data, error } = await supabase.functions.invoke('ai-patient-search', {
        body: {
          query,
          practiceId,
          sessionId
        }
      });
      
      console.log('📨 Edge function response:', data);
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Edge function call failed');
      }
      
      const result: AiSearchResult = data || {};
      
      // Store logs if available
      if (result.logs) {
        setSearchLogs(result.logs);
        console.log('📋 Search logs:', result.logs);
      }
      
      // If not successful, show the error details
      if (!result.success) {
        console.error('Edge function returned error:', result);
        throw new Error(result.error || 'Search failed');
      }
      
      if (result.patientIds) {
        // Filter patients by returned IDs
        const filteredPatients = patients.filter(p => 
          result.patientIds!.includes(p.id)
        );
        
        console.log(`✅ Found ${filteredPatients.length} patients matching criteria`);
        
        // Update state
        setAiFilteredPatients(filteredPatients);
        setSearchDescription(result.description || query);
        setCurrentPage(1);
        
        // Show success message
        if (filteredPatients.length === 0) {
          toast.error('No patients found matching your criteria.');
        } else {
          toast.success(`Found ${filteredPatients.length} patients: ${result.description}`);
        }
      } else {
        throw new Error(result.error || 'Search failed');
      }
      
    } catch (error: any) {
      console.error('❌ AI search error:', error);
      
      let errorMessage = 'AI search failed. ';
      if (error?.message?.includes('fetch')) {
        errorMessage += 'Could not connect to AI service.';
      } else if (error?.message?.includes('CORS')) {
        errorMessage += 'CORS error - check edge function configuration.';
      } else if (error?.message?.includes('OpenAI')) {
        errorMessage += 'OpenAI API error - check API key configuration.';
      } else {
        errorMessage += error?.message || 'Please try again.';
      }
      
      toast.error(errorMessage);
      
      // Clear any previous results on error
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