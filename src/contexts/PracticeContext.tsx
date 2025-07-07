import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface PracticeContextType {
  practiceId: string | null;
  userId: string | null;
  userRole: string | null;
  isLoading: boolean;
  error: Error | null;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

// Global cache for practice data to prevent duplicate fetches
let cachedPracticeData: {
  practiceId: string | null;
  userId: string | null;
  userRole: string | null;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const PracticeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPracticeData = async () => {
      try {
        // Check if we have valid cached data
        if (cachedPracticeData && Date.now() - cachedPracticeData.timestamp < CACHE_DURATION) {
          console.log('📦 Using cached practice data:', cachedPracticeData);
          setPracticeId(cachedPracticeData.practiceId);
          setUserId(cachedPracticeData.userId);
          setUserRole(cachedPracticeData.userRole);
          setIsLoading(false);
          return;
        }

        console.log('🔍 Fetching fresh practice data...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error('User not authenticated');
        }

        setUserId(user.id);
        
        // First try to get practice_id from user metadata
        let currentPracticeId = user.user_metadata?.practice_id;
        let currentUserRole = user.user_metadata?.role;
        
        // If not found in metadata, try to get from users table
        if (!currentPracticeId) {
          const { data: userData, error: dbUserError } = await supabase
            .from('users')
            .select('practice_id, role')
            .eq('id', user.id)
            .single();
          
          if (!dbUserError && userData) {
            currentPracticeId = userData.practice_id;
            currentUserRole = userData.role;
          }
        }
        
        if (!currentPracticeId) {
          throw new Error('No practice_id found for current user');
        }

        // Cache the data
        cachedPracticeData = {
          practiceId: currentPracticeId,
          userId: user.id,
          userRole: currentUserRole,
          timestamp: Date.now()
        };

        setPracticeId(currentPracticeId);
        setUserRole(currentUserRole);
        console.log('✅ Practice data loaded:', { practiceId: currentPracticeId, userId: user.id, userRole: currentUserRole });
      } catch (err) {
        console.error('❌ Error fetching practice data:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPracticeData();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear cache on logout
        cachedPracticeData = null;
        setPracticeId(null);
        setUserId(null);
        setUserRole(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' && session) {
        // Only refetch on actual sign in, not on token refresh
        fetchPracticeData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <PracticeContext.Provider value={{ practiceId, userId, userRole, isLoading, error }}>
      {children}
    </PracticeContext.Provider>
  );
};

export const usePractice = () => {
  const context = useContext(PracticeContext);
  if (context === undefined) {
    throw new Error('usePractice must be used within a PracticeProvider');
  }
  return context;
};

// Helper function to clear cache (useful for testing or forced refresh)
export const clearPracticeCache = () => {
  cachedPracticeData = null;
};