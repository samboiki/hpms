import { useAuthStore } from '../stores/authStore';
import { usePracticeRow } from '../lib/practiceRow';

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
  // The practice row the menu, the tariff list and the diary share (one cached read: lib/practiceRow.ts)
  const practiceId = selectedPracticeId || user?.practice_id;
  const row = usePracticeRow(practiceId);
  const practiceData = (row.data ?? null) as unknown as PracticeData | null;
  const loading = !!practiceId && row.isLoading;
  const error = row.error ? (row.error instanceof Error ? row.error : new Error('The practice could not be loaded')) : null;

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