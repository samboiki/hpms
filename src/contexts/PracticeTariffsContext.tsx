import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface PracticeTariff {
  id: string;
  code: string;
  description: string;
  price: number;
  category?: string;
  subcategory?: string;
  practice_type_name?: string;
}

interface PracticeTariffsContextType {
  allTariffs: PracticeTariff[];
  frequentTariffs: PracticeTariff[];
  practiceType: string;
  isLoading: boolean;
  error: string | null;
  getTariffsByType: (type: string) => PracticeTariff[];
  searchTariffs: (query: string) => PracticeTariff[];
  refreshTariffs: () => Promise<void>;
}

const PracticeTariffsContext = createContext<PracticeTariffsContextType | undefined>(undefined);

interface PracticeTariffsProviderProps {
  children: ReactNode;
}

export const PracticeTariffsProvider: React.FC<PracticeTariffsProviderProps> = ({ children }) => {
  const [allTariffs, setAllTariffs] = useState<PracticeTariff[]>([]);
  const [frequentTariffs, setFrequentTariffs] = useState<PracticeTariff[]>([]);
  const [practiceType, setPracticeType] = useState<string>('dental');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPracticeType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();

        if (userProfile?.practice_id) {
          const { data: practice } = await supabase
            .from('practices')
            .select('practice_type')
            .eq('id', userProfile.practice_id)
            .single();

          if (practice?.practice_type) {
            setPracticeType(practice.practice_type);
            return practice.practice_type;
          }
        }
      }
      return 'dental'; // Default fallback
    } catch (err) {
      console.error('Error fetching practice type:', err);
      return 'dental';
    }
  };

  const fetchTariffs = async (currentPracticeType: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all practice tariffs for the practice type
      const { data: allTariffsData, error: allTariffsError } = await supabase
        .from('practice_tariffs_with_types')
        .select('*')
        .eq('practice_type_name', currentPracticeType)
        .not('price', 'is', null)
        .gt('price', 0)
        .order('code');

      if (allTariffsError) throw allTariffsError;

      // Fetch frequent tariffs
      const { data: frequentData, error: frequentError } = await supabase
        .from('frequent_tariff_codes')
        .select('*')
        .eq('practice_type_name', currentPracticeType)
        .limit(12);

      if (frequentError) throw frequentError;

      setAllTariffs(allTariffsData || []);
      setFrequentTariffs(frequentData || []);
    } catch (err) {
      console.error('Error fetching tariffs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tariffs');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTariffs = async () => {
    const currentPracticeType = await fetchPracticeType();
    await fetchTariffs(currentPracticeType);
  };

  useEffect(() => {
    const initializeTariffs = async () => {
      const currentPracticeType = await fetchPracticeType();
      await fetchTariffs(currentPracticeType);
    };

    initializeTariffs();
  }, []);

  const getTariffsByType = (type: string): PracticeTariff[] => {
    return allTariffs.filter(tariff => 
      tariff.practice_type_name === type
    );
  };

  const searchTariffs = (query: string): PracticeTariff[] => {
    if (!query.trim()) return allTariffs;
    
    const lowercaseQuery = query.toLowerCase();
    return allTariffs.filter(tariff =>
      tariff.code?.toLowerCase().includes(lowercaseQuery) ||
      tariff.description?.toLowerCase().includes(lowercaseQuery)
    );
  };

  const value: PracticeTariffsContextType = {
    allTariffs,
    frequentTariffs,
    practiceType,
    isLoading,
    error,
    getTariffsByType,
    searchTariffs,
    refreshTariffs
  };

  return (
    <PracticeTariffsContext.Provider value={value}>
      {children}
    </PracticeTariffsContext.Provider>
  );
};

export const usePracticeTariffs = (): PracticeTariffsContextType => {
  const context = useContext(PracticeTariffsContext);
  if (context === undefined) {
    throw new Error('usePracticeTariffs must be used within a PracticeTariffsProvider');
  }
  return context;
};

export default PracticeTariffsContext;