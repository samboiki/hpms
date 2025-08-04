import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fastAuth } from '../lib/supabaseFast';
import { lightningCache } from '../lib/lightningCache';

interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  practice_id: string | null;
  hpcsa_number?: string;
  avatar?: string;
}

interface Practice {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  business_hours?: any;
  features?: any;
  timezone?: string;
  currency?: string;
  tax_number?: string;
  license_number?: string;
  practice_type?: string;
  practice_subtypes?: string[];
}

interface UseCurrentUserAndPracticeReturn {
  currentUser: CurrentUser | null;
  practice: Practice | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Cache for user and practice data with 10-minute TTL
const USER_PRACTICE_CACHE_TTL = 10 * 60 * 1000;
let cachedData: {
  user: CurrentUser | null;
  practice: Practice | null;
  timestamp: number;
} | null = null;

export const useCurrentUserAndPracticeFast = (): UseCurrentUserAndPracticeReturn => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchUserAndPractice = async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < USER_PRACTICE_CACHE_TTL) {
        console.log('⚡ User/Practice cache HIT');
        if (isMounted.current) {
          setCurrentUser(cachedData.user);
          setPractice(cachedData.practice);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      // Use fast auth to get session
      const { data: { session }, error: sessionError } = await fastAuth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get session: ' + sessionError.message);
      }

      if (!session?.user) {
        throw new Error('No authenticated user found');
      }

      // Use lightning cache for user data
      const userData = await lightningCache.get(
        `user:${session.user.email}`,
        async () => {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .single();

          if (error) throw error;
          return data;
        },
        USER_PRACTICE_CACHE_TTL
      );

      if (!userData) {
        throw new Error('User not found in users table');
      }

      // Use lightning cache for practice data
      let practiceData: Practice | null = null;
      if (userData.practice_id) {
        practiceData = await lightningCache.get(
          `practice:${userData.practice_id}`,
          async () => {
            const { data, error } = await supabase
              .from('practices')
              .select('*')
              .eq('id', userData.practice_id)
              .single();

            if (error) {
              console.error('Failed to fetch practice data:', error);
              return null;
            }
            return data;
          },
          USER_PRACTICE_CACHE_TTL
        );
      }

      // Update cache
      cachedData = {
        user: userData,
        practice: practiceData,
        timestamp: Date.now()
      };

      if (isMounted.current) {
        setCurrentUser(userData);
        setPractice(practiceData);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      if (isMounted.current) {
        setError(errorMessage);
      }
      console.error('Error fetching user and practice data:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchUserAndPractice();
  }, []);

  const refetch = async () => {
    await fetchUserAndPractice(true); // Force refresh
  };

  return {
    currentUser,
    practice,
    loading,
    error,
    refetch
  };
};

// Export a function to clear the cache when needed
export const clearUserPracticeCache = () => {
  cachedData = null;
};