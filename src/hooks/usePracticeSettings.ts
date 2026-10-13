import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface PracticeFeature {
  id: string;
  practice_id: string;
  feature_key: string;
  is_enabled: boolean;
  limit_value: number | null;
  current_usage: number;
  settings: any;
  expires_at: string | null;
}

export interface PracticeSubscription {
  id: string;
  practice_id: string;
  service_plan_id: string;
  status: string;
  current_usage: any;
  billing_cycle_start: string;
  billing_cycle_end: string;
  auto_renew: boolean;
  service_plan?: {
    id: string;
    name: string;
    plan_type: string;
    price_monthly: number;
    limits: any;
    features: string[];
  };
}

export interface SMSSubscription {
  id: string;
  practice_id: string;
  monthly_limit: number;
  current_usage: number;
  additional_sms_purchased: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  auto_renew: boolean;
  is_active: boolean;
}

export interface EmailSubscription {
  id: string;
  practice_id: string;
  monthly_limit: number;
  current_usage: number;
  additional_emails_purchased: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  auto_renew: boolean;
  is_active: boolean;
}

export interface PracticeSettings {
  practiceId: string;
  maxUsers: number;
  maxPatients: number;
  features: PracticeFeature[];
  subscriptions: PracticeSubscription[];
  smsSubscription: SMSSubscription | null;
  emailSubscription: EmailSubscription | null;
  canRecordVitals: boolean;
  canTrackLab: boolean;
  canTrackMedia: boolean;
  canUseSMS: boolean;
  canUseEmail: boolean;
  smsLimit: number;
  smsUsed: number;
  smsRemaining: number;
  emailLimit: number;
  emailUsed: number;
  emailRemaining: number;
}

export const usePracticeSettings = () => {
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, selectedPracticeId } = useAuthStore();
  // Same rule as the dashboard and Finance page: the practice a super admin switched to, else the
  // user's own. This used to read `currentPractice`, which the auth store never had, so settings
  // never loaded and everything they guard (recording vitals, SMS/email limits) showed as unavailable.
  const practiceId = selectedPracticeId || user?.practice_id || null;

  const loadPracticeSettings = async () => {
    if (!practiceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load practice details for basic limits
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('id, max_users, max_patients')
        .eq('id', practiceId)
        .single();

      if (practiceError) throw practiceError;

      // Load practice features
      const { data: featuresData, error: featuresError } = await supabase
        .from('practice_features')
        .select('*')
        .eq('practice_id', practiceId);

      if (featuresError) throw featuresError;

      // Load practice subscriptions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('practice_service_subscriptions')
        .select(`
          *,
          service_plan:service_plans(*)
        `)
        .eq('practice_id', practiceId)
        .eq('status', 'active');

      if (subscriptionsError) throw subscriptionsError;

      // Load SMS subscription
      const { data: smsData, error: smsError } = await supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single();

      // Load email subscription (table may not exist yet)
      let emailData = null;
      let emailError = null;
      try {
        const emailResult = await supabase
          .from('practice_email_subscriptions')
          .select('*')
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .single();
        emailData = emailResult.data;
        emailError = emailResult.error;
      } catch (err) {
        emailError = err;
      }

      // Process features
      const features = featuresData || [];
      const subscriptions = subscriptionsData || [];
      const smsSubscription = smsError ? null : smsData;
      const emailSubscription = emailError ? null : emailData;

      // Calculate feature permissions
      const vitalsFeature = features.find(f => f.feature_key === 'vitals_tracking');
      const labFeature = features.find(f => f.feature_key === 'lab_integration');
      const mediaFeature = features.find(f => f.feature_key === 'media_requests');

      // A plan without a features list must not throw: that failed the whole load and locked every feature
      const planIncludesFeature = (feature: string) =>
        subscriptions.some(s => {
          const planFeatures = s.service_plan?.features;
          return s.service_plan?.plan_type === 'feature' && Array.isArray(planFeatures) && planFeatures.includes(feature);
        });

      const canRecordVitals = !!vitalsFeature?.is_enabled || planIncludesFeature('vitals_recording');

      const canTrackLab = !!labFeature?.is_enabled || planIncludesFeature('lab_requests');

      const canTrackMedia = !!mediaFeature?.is_enabled || planIncludesFeature('imaging_requests');

      const canUseSMS = !!smsSubscription || 
        subscriptions.some(s => s.service_plan?.plan_type === 'sms');

      const canUseEmail = !!emailSubscription || 
        subscriptions.some(s => s.service_plan?.plan_type === 'email');

      // Calculate SMS limits
      const smsLimit = smsSubscription ? 
        smsSubscription.monthly_limit + (smsSubscription.additional_sms_purchased || 0) : 0;
      const smsUsed = smsSubscription?.current_usage || 0;
      const smsRemaining = Math.max(0, smsLimit - smsUsed);

      // Calculate email limits
      const emailLimit = emailSubscription ? 
        emailSubscription.monthly_limit + (emailSubscription.additional_emails_purchased || 0) : 0;
      const emailUsed = emailSubscription?.current_usage || 0;
      const emailRemaining = Math.max(0, emailLimit - emailUsed);

      const practiceSettings: PracticeSettings = {
        practiceId,
        maxUsers: practiceData.max_users || 0,
        maxPatients: practiceData.max_patients || 0,
        features,
        subscriptions,
        smsSubscription,
        emailSubscription,
        canRecordVitals,
        canTrackLab,
        canTrackMedia,
        canUseSMS,
        canUseEmail,
        smsLimit,
        smsUsed,
        smsRemaining,
        emailLimit,
        emailUsed,
        emailRemaining
      };

      setSettings(practiceSettings);

    } catch (err) {
      console.error('Error loading practice settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load practice settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSMSUsage = async (additionalUsage: number) => {
    if (!settings?.smsSubscription) return false;

    try {
      const newUsage = settings.smsUsed + additionalUsage;
      
      // Check if usage would exceed limit
      if (newUsage > settings.smsLimit) {
        throw new Error(`SMS limit exceeded. You have ${settings.smsRemaining} SMS remaining.`);
      }

      const { error } = await supabase
        .from('practice_sms_subscriptions')
        .update({ current_usage: newUsage })
        .eq('id', settings.smsSubscription.id);

      if (error) throw error;

      // Update local state
      setSettings(prev => prev ? {
        ...prev,
        smsUsed: newUsage,
        smsRemaining: prev.smsLimit - newUsage
      } : null);

      return true;
    } catch (err) {
      console.error('Error updating SMS usage:', err);
      throw err;
    }
  };

  const updateEmailUsage = async (additionalUsage: number) => {
    if (!settings?.emailSubscription) return false;

    try {
      const newUsage = settings.emailUsed + additionalUsage;
      
      // Check if usage would exceed limit
      if (newUsage > settings.emailLimit) {
        throw new Error(`Email limit exceeded. You have ${settings.emailRemaining} emails remaining.`);
      }

      const { error } = await supabase
        .from('practice_email_subscriptions')
        .update({ current_usage: newUsage })
        .eq('id', settings.emailSubscription.id);

      if (error) throw error;

      // Update local state
      setSettings(prev => prev ? {
        ...prev,
        emailUsed: newUsage,
        emailRemaining: prev.emailLimit - newUsage
      } : null);

      return true;
    } catch (err) {
      console.error('Error updating email usage:', err);
      throw err;
    }
  };

  const checkFeatureAccess = (featureKey: string): boolean => {
    if (!settings) return false;

    switch (featureKey) {
      case 'vitals_tracking':
        return settings.canRecordVitals;
      case 'lab_integration':
        return settings.canTrackLab;
      case 'media_requests':
        return settings.canTrackMedia;
      case 'sms_service':
        return settings.canUseSMS && settings.smsRemaining > 0;
      case 'email_service':
        return settings.canUseEmail && settings.emailRemaining > 0;
      default:
        return false;
    }
  };

  useEffect(() => {
    loadPracticeSettings();
  }, [practiceId]);

  return {
    settings,
    loading,
    error,
    refreshSettings: loadPracticeSettings,
    updateSMSUsage,
    updateEmailUsage,
    checkFeatureAccess
  };
};