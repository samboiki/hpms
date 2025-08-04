import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getOptimizedTariffs, getOptimizedFrequentTariffs } from '../lib/optimizedQueries';

interface PracticeTariff {
  id: string;
  code: string;
  description: string;
  price: number;
  official_2025_price_nad?: number;
  on_2025_list?: string;
  found_in_claims?: string;
  requires_tooth_number?: string;
  can_be_multiplied?: string;
  business_rule_formula?: string;
  example_calculation?: string;
  notes?: string;
  unit?: string;
  is_active?: boolean;
  effective_from?: string;
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
  getTariffByCode: (code: string) => PracticeTariff | undefined;
  refreshTariffs: () => Promise<void>;
  invalidateCache: () => void;
}

const PracticeTariffsContext = createContext<PracticeTariffsContextType | undefined>(undefined);

interface PracticeTariffsProviderProps {
  children: ReactNode;
}

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_KEY_PREFIX = 'practice_tariffs_';

// Fallback tariffs for offline/error scenarios
const getFallbackTariffs = (): PracticeTariff[] => [
  { id: '1', code: '8101', description: 'Full mouth examination, charting and treatment planning', price: 254.7, official_2025_price_nad: 254.7, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '254.7 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '2', code: '8102', description: 'Comprehensive consultation', price: 479, official_2025_price_nad: 479, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '479.0 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '3', code: '8104', description: 'Examination or consultation for a specific problem', price: 137.4, official_2025_price_nad: 137.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '137.4 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '4', code: '8107', description: 'Intra-oral radiographs, per film', price: 135.4, official_2025_price_nad: 135.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'YES', business_rule_formula: 'Base price × number of X-rays', example_calculation: '135.4 × 3 = 406.20 (for 3 X-rays)', notes: '', unit: 'per item', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '5', code: '8211', description: 'Removal of unerupted/impacted tooth', price: 802.4, official_2025_price_nad: 802.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price per tooth', example_calculation: '802.4 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '6', code: '8341', description: 'Amalgam - one surface', price: 373.9, official_2025_price_nad: 373.9, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'YES', business_rule_formula: 'Per tooth', example_calculation: '373.9 per tooth', notes: '', unit: 'per item', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '7', code: '8315', description: 'Root canal treatment - single rooted tooth', price: 1087.2, official_2025_price_nad: 1087.2, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'YES', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price per tooth', example_calculation: '1087.2 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '8', code: '8621', description: 'Prophylaxis', price: 234.4, official_2025_price_nad: 234.4, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '234.4 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '9', code: '8711', description: 'Complete upper denture', price: 3456.8, official_2025_price_nad: 3456.8, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '3456.8 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' },
  { id: '10', code: '8826', description: 'CBCT capture both arches with orbits', price: 988.3, official_2025_price_nad: 988.3, on_2025_list: 'YES', found_in_claims: 'YES', requires_tooth_number: 'NO', can_be_multiplied: 'NO', business_rule_formula: 'Fixed price', example_calculation: '988.3 NAD', notes: '', unit: 'per visit', is_active: true, effective_from: '2025-01-01', practice_type_name: 'dental' }
];

export const PracticeTariffsProvider: React.FC<PracticeTariffsProviderProps> = ({ children }) => {
  const [allTariffs, setAllTariffs] = useState<PracticeTariff[]>([]);
  const [frequentTariffs, setFrequentTariffs] = useState<PracticeTariff[]>([]);
  const [practiceType, setPracticeType] = useState<string>('dental');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  // Cache management
  const getCacheKey = (practiceType: string) => `${CACHE_KEY_PREFIX}${practiceType}`;
  
  const loadFromCache = (practiceType: string): { tariffs: PracticeTariff[]; frequent: PracticeTariff[]; timestamp: number } | null => {
    try {
      const cacheKey = getCacheKey(practiceType);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();
        if (now - data.timestamp < CACHE_DURATION) {
          console.log('✅ Loaded tariffs from cache');
          return data;
        } else {
          console.log('🕒 Cache expired, will fetch fresh data');
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (err) {
      console.warn('Cache read error:', err);
    }
    return null;
  };

  const saveToCache = (practiceType: string, tariffs: PracticeTariff[], frequent: PracticeTariff[]) => {
    try {
      const cacheKey = getCacheKey(practiceType);
      const data = {
        tariffs,
        frequent,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setCacheTimestamp(data.timestamp);
      console.log('💾 Saved tariffs to cache');
    } catch (err) {
      console.warn('Cache write error:', err);
    }
  };

  const invalidateCache = useCallback(() => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      setCacheTimestamp(null);
      console.log('🗑️ Cache invalidated');
    } catch (err) {
      console.warn('Cache invalidation error:', err);
    }
  }, []);

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

  const fetchTariffs = async (currentPracticeType: string, useCache = true) => {
    try {
      setIsLoading(true);
      setError(null);

      // Try cache first
      if (useCache) {
        const cached = loadFromCache(currentPracticeType);
        if (cached) {
          setAllTariffs(cached.tariffs);
          setFrequentTariffs(cached.frequent);
          setCacheTimestamp(cached.timestamp);
          setIsLoading(false);
          return;
        }
      }

      console.log('🔍 Fetching fresh tariff data...');

      try {
        // Use optimized queries with caching
        const [allTariffsData, frequentData] = await Promise.all([
          getOptimizedTariffs(currentPracticeType),
          getOptimizedFrequentTariffs(currentPracticeType)
        ]);

        if (!allTariffsData || allTariffsData.length === 0) {
          console.warn('No tariffs found, using fallback tariffs');
          const fallbackTariffs = getFallbackTariffs();
          setAllTariffs(fallbackTariffs);
          setFrequentTariffs(fallbackTariffs.slice(0, 8));
          setError(null); // Don't show error if we have fallback
          return;
        }

        // If no frequent data, use first 8 tariffs as frequent
        const frequentTariffsToUse = frequentData?.length > 0 
          ? frequentData 
          : allTariffsData.slice(0, 8);

        const tariffs = allTariffsData || [];
        setAllTariffs(tariffs);
        setFrequentTariffs(frequentTariffsToUse);

        // Save to cache
        if (tariffs.length > 0) {
          saveToCache(currentPracticeType, tariffs, frequentTariffsToUse);
        }

        console.log(`✅ Loaded ${tariffs.length} tariffs, ${frequentTariffsToUse.length} frequent`);
      } catch (err) {
        console.error('Error fetching tariffs:', err);
        
        // Use fallback tariffs
        const fallbackTariffs = getFallbackTariffs();
        setAllTariffs(fallbackTariffs);
        setFrequentTariffs(fallbackTariffs.slice(0, 8));
        setError(null); // Don't show error if we have fallback data
        
        console.log('✅ Using fallback tariffs due to fetch error');
      }
    } catch (err) {
      console.error('Error in fetchTariffs:', err);
      setError('Failed to load tariffs');
      
      // Use fallback tariffs
      const fallbackTariffs = getFallbackTariffs();
      setAllTariffs(fallbackTariffs);
      setFrequentTariffs(fallbackTariffs.slice(0, 8));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTariffs = async () => {
    invalidateCache();
    const currentPracticeType = await fetchPracticeType();
    await fetchTariffs(currentPracticeType, false); // Skip cache
  };

  useEffect(() => {
    const initializeTariffs = async () => {
      const currentPracticeType = await fetchPracticeType();
      await fetchTariffs(currentPracticeType, true); // Use cache
    };

    initializeTariffs();
  }, []);

  const getTariffsByType = useCallback((type: string): PracticeTariff[] => {
    return allTariffs.filter(tariff => 
      tariff.practice_type_name === type
    );
  }, [allTariffs]);

  const searchTariffs = useCallback((query: string): PracticeTariff[] => {
    if (!query.trim()) return allTariffs;
    
    const lowercaseQuery = query.toLowerCase();
    return allTariffs.filter(tariff =>
      tariff.code?.toLowerCase().includes(lowercaseQuery) ||
      tariff.description?.toLowerCase().includes(lowercaseQuery) ||
      tariff.notes?.toLowerCase().includes(lowercaseQuery)
    );
  }, [allTariffs]);

  const getTariffByCode = useCallback((code: string): PracticeTariff | undefined => {
    return allTariffs.find(tariff => tariff.code === code);
  }, [allTariffs]);

  const value: PracticeTariffsContextType = {
    allTariffs,
    frequentTariffs,
    practiceType,
    isLoading,
    error,
    getTariffsByType,
    searchTariffs,
    getTariffByCode,
    refreshTariffs,
    invalidateCache
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