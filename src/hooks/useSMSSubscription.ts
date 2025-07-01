import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface SMSSubscription {
  id: string;
  practice_id: string;
  subscription_type: string;
  monthly_limit: number;
  current_usage: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  is_active: boolean;
  auto_renew: boolean;
  overage_allowed: boolean;
  overage_rate?: number;
}

export function useSMSSubscription(practiceId: string) {
  return useQuery({
    queryKey: ['sms-subscription', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .gte('billing_cycle_end', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as SMSSubscription;
    },
    enabled: !!practiceId,
    refetchInterval: 60000, // Refetch every minute to keep usage updated
  });
}

export function useCanSendSMS(practiceId: string) {
  const { data: subscription, isLoading } = useSMSSubscription(practiceId);
  
  if (isLoading || !subscription) {
    return { canSend: false, reason: 'Loading subscription...' };
  }

  if (!subscription.is_active) {
    return { canSend: false, reason: 'SMS subscription is not active' };
  }

  const remaining = subscription.monthly_limit - subscription.current_usage;
  
  if (remaining <= 0 && !subscription.overage_allowed) {
    return { 
      canSend: false, 
      reason: 'Monthly SMS limit reached. Please upgrade your plan to continue sending messages.' 
    };
  }

  if (remaining <= 0 && subscription.overage_allowed) {
    return { 
      canSend: true, 
      reason: `Overage charges will apply at ${subscription.overage_rate || 0.10} per SMS` 
    };
  }

  return { canSend: true, reason: null };
}