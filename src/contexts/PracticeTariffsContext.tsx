import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loadPracticeRow } from '../lib/practiceRow';
import { getOptimizedTariffs, getOptimizedFrequentTariffs } from '../lib/optimizedQueries';
import { useAuthStore } from '../stores/authStore';
import { selectBillableTariffs, type TariffRow } from '../utils/billing/pricing';
import { todayKey } from '../utils/billing/dates';

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
  effective_to?: string;
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
  /** Tariff rows left out because they are inactive, expired, not yet effective or ambiguous. */
  excludedCount: number;
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

/**
 * Keeps only the rows that may be billed today (active, in effect, one version per code) and
 * returns how many rows were left out. There is deliberately no hard-coded fallback price list:
 * billing from it whenever loading failed is how outdated prices reached patients.
 */
const keepBillable = (rows: PracticeTariff[]): { tariffs: PracticeTariff[]; excludedCount: number } => {
  const { tariffs, excluded } = selectBillableTariffs(rows as unknown as TariffRow[], todayKey());
  const billableById = new Map(tariffs.map(tariff => [tariff.id, tariff]));
  const kept = rows.flatMap(row => {
    const billable = billableById.get(row.id);
    // The price is the cleaned, cent-rounded tariff price used everywhere else
    return billable ? [{ ...row, price: billable.unitPrice }] : [];
  });
  return { tariffs: kept, excludedCount: excluded.length };
};

export const PracticeTariffsProvider: React.FC<PracticeTariffsProviderProps> = ({ children }) => {
  // Practice scoping: the practice a super admin switched to, otherwise the user's own practice
  const selectedPracticeId = useAuthStore(state => state.selectedPracticeId);
  const userPracticeId = useAuthStore(state => state.user?.practice_id);
  const practiceId = selectedPracticeId || userPracticeId || null;
  const queryClient = useQueryClient();

  const [allTariffs, setAllTariffs] = useState<PracticeTariff[]>([]);
  const [frequentTariffs, setFrequentTariffs] = useState<PracticeTariff[]>([]);
  const [practiceType, setPracticeType] = useState<string>('dental');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);

  // Cache management: raw rows are cached; effective dates are checked again on every load
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
      console.log('🗑️ Cache invalidated');
    } catch (err) {
      console.warn('Cache invalidation error:', err);
    }
  }, []);

  // The practice's type decides its tariff list; no guessing ("dental") when it is unknown
  // From the practice row the menu and the diary share (lib/practiceRow.ts), not a read of its own
  const fetchPracticeType = async (): Promise<string | null> => {
    if (!practiceId) return null;
    const practice = await loadPracticeRow(practiceId, queryClient);
    return typeof practice?.practice_type === 'string' ? practice.practice_type : null;
  };

  const clearTariffs = (message: string | null) => {
    setAllTariffs([]);
    setFrequentTariffs([]);
    setExcludedCount(0);
    setError(message);
  };

  // Shows only tariffs that can be billed today; frequent codes are limited to those too
  const applyRows = (rows: PracticeTariff[], frequentRows: PracticeTariff[]) => {
    const { tariffs, excludedCount: excludedRows } = keepBillable(rows);
    const billableIds = new Set(tariffs.map(tariff => tariff.id));
    const frequent = keepBillable(frequentRows).tariffs.filter(tariff => billableIds.has(tariff.id));
    setAllTariffs(tariffs);
    setFrequentTariffs(frequent.length > 0 ? frequent : tariffs.slice(0, 8));
    setExcludedCount(excludedRows);
    if (tariffs.length === 0) setError('No tariff codes are in effect today. Ask an administrator to check the tariff list.');
  };

  const fetchTariffs = async (currentPracticeType: string, useCache = true) => {
    try {
      setIsLoading(true);
      setError(null);

      // Try cache first
      if (useCache) {
        const cached = loadFromCache(currentPracticeType);
        if (cached) {
          applyRows(cached.tariffs, cached.frequent);
          return;
        }
      }

      console.log('🔍 Fetching fresh tariff data...');

      const [allTariffsData, frequentData] = await Promise.all([
        getOptimizedTariffs(currentPracticeType),
        getOptimizedFrequentTariffs(currentPracticeType)
      ]);

      // No fallback price list: billing must stop until the real tariff list loads
      if (!allTariffsData || allTariffsData.length === 0) {
        clearTariffs(`No tariff codes could be loaded for ${currentPracticeType} practices. Services cannot be billed until the tariff list loads.`);
        return;
      }

      const rows = allTariffsData as unknown as PracticeTariff[];
      const frequentRows = (frequentData ?? []) as unknown as PracticeTariff[];
      applyRows(rows, frequentRows);
      saveToCache(currentPracticeType, rows, frequentRows);
    } catch (err) {
      console.error('Error in fetchTariffs:', err);
      clearTariffs('Could not load the tariff list. Services cannot be billed until it loads.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadForPractice = async (useCache: boolean) => {
    if (!practiceId) {
      clearTariffs(null);
      setIsLoading(false);
      return;
    }
    try {
      const currentPracticeType = await fetchPracticeType();
      if (!currentPracticeType) {
        clearTariffs('The practice type is not set, so its tariff list is unknown.');
        setIsLoading(false);
        return;
      }
      setPracticeType(currentPracticeType);
      await fetchTariffs(currentPracticeType, useCache);
    } catch (err) {
      console.error('Error fetching practice type:', err);
      clearTariffs('Could not load the practice details, so its tariff list cannot be loaded.');
      setIsLoading(false);
    }
  };

  const refreshTariffs = async () => {
    invalidateCache();
    await loadForPractice(false); // Skip cache
  };

  useEffect(() => {
    loadForPractice(true); // Use cache
  }, [practiceId]);

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
    excludedCount,
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