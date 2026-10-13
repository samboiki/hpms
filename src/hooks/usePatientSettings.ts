import { useState, useEffect } from 'react';
import { plainWords } from '../utils/plainErrors';
import { supabase } from '../lib/supabase';
import { usePractice } from '../contexts/PracticeContext';

// Default country, default language, data-processing consent, data-export requests and anonymising after 7 years used
// to be options here too: they were saved but nothing read them, so they were removed (owner, 13 Oct 2026)
export interface PatientSettings {
  inactiveThresholdDays: number;
  sendSmsReminders: boolean;
  sendEmailReminders: boolean;
  allowPromotionalOptIn: boolean;
}

const DEFAULT_SETTINGS: PatientSettings = {
  inactiveThresholdDays: 180, // 6 months
  sendSmsReminders: true,
  sendEmailReminders: true,
  allowPromotionalOptIn: false,
};

export const usePatientSettings = () => {
  const { practiceId } = usePractice();
  const [settings, setSettings] = useState<PatientSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings from database
  const loadSettings = async () => {
    if (!practiceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('practice_settings')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('setting_key', 'patient_settings')
        .single();

      if (dbError && dbError.code !== 'PGRST116') {
        throw dbError;
      }

      if (data?.setting_value) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.setting_value });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Error loading patient settings:', err);
      setError(err instanceof Error ? plainWords(err.message) : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Save settings to database
  const saveSettings = async (newSettings: PatientSettings) => {
    if (!practiceId) {
      setError('No practice ID available');
      return false;
    }

    try {
      setSaving(true);
      setError(null);

      // Check if settings already exist
      const { data: existingData, error: checkError } = await supabase
        .from('practice_settings')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('setting_key', 'patient_settings')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingData) {
        // Update existing settings (an update the database refuses changes no row and returns no error)
        const { data: updatedRows, error: updateError } = await supabase
          .from('practice_settings')
          .update({
            setting_value: newSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingData.id)
          .select('id');

        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) throw new Error('No settings row was changed');
      } else {
        // Insert new settings
        const { error: insertError } = await supabase
          .from('practice_settings')
          .insert({
            practice_id: practiceId,
            setting_key: 'patient_settings',
            setting_value: newSettings,
            setting_type: 'json',
            description: 'Patient management settings',
            is_public: false,
          });

        if (insertError) throw insertError;
      }

      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('Error saving patient settings:', err);
      setError(err instanceof Error ? plainWords(err.message) : 'Failed to save settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Update a single setting
  const updateSetting = async <K extends keyof PatientSettings>(
    key: K,
    value: PatientSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    return saveSettings(newSettings);
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  return {
    settings,
    loading,
    saving,
    error,
    saveSettings,
    updateSetting,
    reloadSettings: loadSettings,
  };
};