import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface PracticeData {
  id: string;
  name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
}

export function usePracticeData() {
  const { user, selectedPracticeId } = useAuthStore();
  const [practiceData, setPracticeData] = useState<PracticeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPracticeData = async () => {
      const practiceId = selectedPracticeId || user?.practice_id;
      if (!practiceId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('practices')
          .select('*')
          .eq('id', practiceId)
          .single();

        if (fetchError) throw fetchError;
        setPracticeData(data);
      } catch (err) {
        console.error('Error fetching practice data:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPracticeData();
  }, [selectedPracticeId, user?.practice_id]);

  // Generate color variations
  const getColorVariations = () => {
    if (!practiceData) return null;

    const primary = practiceData.primary_color || '#6366f1';
    const secondary = practiceData.secondary_color || primary;

    return {
      primary,
      secondary,
      gradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      gradientHover: `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)`,
      light: `${primary}20`,
      medium: `${primary}50`,
      dark: `${primary}80`,
    };
  };

  return {
    practiceData,
    loading,
    error,
    colors: getColorVariations(),
  };
}