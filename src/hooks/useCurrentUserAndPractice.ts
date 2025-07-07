import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

export const useCurrentUserAndPractice = (): UseCurrentUserAndPracticeReturn => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserAndPractice = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get session: ' + sessionError.message);
      }

      if (!session?.user) {
        throw new Error('No authenticated user found');
      }

      // Fetch user details from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (userError) {
        throw new Error('Failed to fetch user data: ' + userError.message);
      }

      if (!userData) {
        throw new Error('User not found in users table');
      }

      setCurrentUser(userData);

      // Fetch practice details if user has a practice_id
      if (userData.practice_id) {
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select('*')
          .eq('id', userData.practice_id)
          .single();

        if (practiceError) {
          console.error('Failed to fetch practice data:', practiceError);
          // Don't throw here, just log the error
        } else {
          setPractice(practiceData);
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching user and practice data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserAndPractice();
  }, []);

  const refetch = async () => {
    await fetchUserAndPractice();
  };

  return {
    currentUser,
    practice,
    loading,
    error,
    refetch
  };
};