import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Patient } from '../stores/patientsStoreNew';

export interface AiFilters {
  results: Patient[];
  description: string;
  sql_query: string;
}

export const useAiSearch = (
  patients: Patient[], 
  calculateAge: (dateOfBirth: string) => number,
  setCurrentPage: (page: number) => void
) => {
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiFilters, setAiFilters] = useState<AiFilters | null>(null);

  const handleAiSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim() || isAiSearching) return;
    
    console.log('🔍 AI Search initiated with query:', searchTerm);
    setIsAiSearching(true);
    
    try {
      console.log('📡 Calling Edge Function ai-search-patients...');
      const { data, error } = await supabase.functions.invoke('ai-search-patients', {
        body: {
          query: searchTerm
        }
      });
      
      console.log('📨 Edge Function response:', { data, error });
      
      if (error) {
        console.error('❌ Edge Function error:', error);
        throw error;
      }
      
      if (!data || !data.sql_query) {
        console.error('❌ No SQL query returned from Edge Function');
        throw new Error('No SQL query generated');
      }
      
      console.log('✅ SQL Query generated:', data.sql_query);
      
      let queryResults: Patient[] | null = null;
      
      try {
        const whereMatch = data.sql_query.match(/WHERE\s+(.*?)\s+ORDER\s+BY/is);
        
        if (whereMatch) {
          const conditions = whereMatch[1];
          console.log('📋 WHERE conditions:', conditions);
          
          const hasJoins = data.sql_query.toLowerCase().includes('join');
          
          if (!hasJoins && conditions) {
            let filteredPatients = [...patients];
            
            const ilikeMatches = [...conditions.matchAll(/(?:patients\.)?(\w+)\s+ILIKE\s+'%([^%]+)%'/gi)];
            for (const match of ilikeMatches) {
              const [_, column, value] = match;
              console.log(`🔍 Filtering by ${column} ILIKE '%${value}%'`);
              filteredPatients = filteredPatients.filter(p => {
                const fieldValue = p[column as keyof Patient];
                return fieldValue && String(fieldValue).toLowerCase().includes(value.toLowerCase());
              });
            }
            
            const equalMatches = [...conditions.matchAll(/(?:patients\.)?(\w+)\s*=\s*'([^']+)'/gi)];
            for (const match of equalMatches) {
              const [_, column, value] = match;
              console.log(`🔍 Filtering by ${column} = '${value}'`);
              filteredPatients = filteredPatients.filter(p => {
                const fieldValue = p[column as keyof Patient];
                return String(fieldValue) === value;
              });
            }
            
            const ageMatch = conditions.match(/EXTRACT\(YEAR FROM AGE\(patients\.date_of_birth\)\)\s*([><=]+)\s*(\d+)/i);
            if (ageMatch) {
              const [_, operator, ageValue] = ageMatch;
              const age = parseInt(ageValue);
              console.log(`🎂 Filtering by age ${operator} ${age}`);
              
              filteredPatients = filteredPatients.filter(p => {
                if (!p.date_of_birth) return false;
                const patientAge = calculateAge(p.date_of_birth);
                switch(operator) {
                  case '>': return patientAge > age;
                  case '<': return patientAge < age;
                  case '>=': return patientAge >= age;
                  case '<=': return patientAge <= age;
                  case '=': return patientAge === age;
                  default: return true;
                }
              });
            }
            
            queryResults = filteredPatients;
            console.log(`✅ Filtered to ${queryResults.length} patients`);
            
          } else if (hasJoins) {
            const complaintMatch = data.sql_query.match(/chief_complaint\s+ILIKE\s+'%([^%]+)%'/i);
            if (complaintMatch) {
              const complaint = complaintMatch[1];
              console.log(`🏥 Searching for visits with complaint: ${complaint}`);
              
              const { data: visits, error: visitsError } = await supabase
                .from('visits')
                .select('patient_id')
                .ilike('chief_complaint', `%${complaint}%`);
              
              if (!visitsError && visits) {
                const patientIds = [...new Set(visits.map(v => v.patient_id))];
                queryResults = patients.filter(p => patientIds.includes(p.id));
                console.log(`✅ Found ${queryResults.length} patients with complaint "${complaint}"`);
              }
            } else {
              queryResults = [];
            }
          }
        } else {
          queryResults = patients;
        }
      } catch (err) {
        console.error('❌ Error parsing SQL:', err);
        queryResults = [];
      }
      
      if (queryResults) {
        console.log('✅ Query executed successfully. Found', queryResults.length, 'patients');
        
        setAiFilters({
          results: queryResults,
          description: data.description || searchTerm,
          sql_query: data.sql_query
        });
        setCurrentPage(1);
        
        if (queryResults.length === 0) {
          toast.error('No patients found matching your criteria.');
        } else {
          toast.success(`Found ${queryResults.length} patients matching your criteria.`);
        }
      }
      
    } catch (error: any) {
      console.error('❌ AI search error:', error);
      let errorMessage = 'AI search failed. ';
      if (error?.message?.includes('CORS')) {
        errorMessage += 'CORS error - check Edge Function deployment.';
      } else if (error?.message?.includes('OpenAI')) {
        errorMessage += 'OpenAI API error - check API key configuration.';
      } else {
        errorMessage += 'Please check console for details.';
      }
      toast.error(errorMessage);
    } finally {
      setIsAiSearching(false);
    }
  }, [isAiSearching, patients, calculateAge, setCurrentPage]);

  const clearAiFilters = useCallback(() => {
    setAiFilters(null);
  }, []);

  return {
    isAiSearching,
    aiFilters,
    handleAiSearch,
    clearAiFilters,
  };
};