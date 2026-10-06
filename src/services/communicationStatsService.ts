import { supabase } from '../lib/supabase';

export interface CommunicationStats {
  sms: {
    current_usage: number;
    monthly_limit: number;
    percentage_available: number;
    available: number;
  };
  email: {
    current_usage: number;
    monthly_limit: number;
    percentage_available: number;
    available: number;
  };
  overall_percentage_available: number;
}

export class CommunicationStatsService {
  static async getCommunicationStats(practiceId: string): Promise<CommunicationStats> {
    try {
      if (!practiceId) {
        throw new Error('Practice ID is required');
      }

      console.log('🔍 Fetching SMS subscription data for practice:', practiceId);
      
      // Fetch SMS subscription data for the user's practice
      const { data: smsData, error: smsError } = await supabase
        .from('practice_sms_subscriptions')
        .select('current_usage, monthly_limit, additional_sms_purchased')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single();

      if (smsError && smsError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('❌ Error fetching SMS data:', smsError);
      } else if (smsData) {
        console.log('✅ SMS subscription data found:', smsData);
      } else {
        console.log('⚠️ No SMS subscription data found for practice:', practiceId);
      }

      console.log('🔍 Fetching email subscription data for practice:', practiceId);
      
      // Fetch email subscription data for the user's practice
      const { data: emailData, error: emailError } = await supabase
        .from('practice_email_subscriptions')
        .select('current_usage, monthly_limit, additional_emails_purchased')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single();

      if (emailError && emailError.code !== 'PGRST116') {
        console.error('❌ Error fetching email data:', emailError);
      } else if (emailData) {
        console.log('✅ Email subscription data found:', emailData);
      } else {
        console.log('⚠️ No email subscription data found for practice:', practiceId);
      }

      // Without an active bundle nothing can be sent, so report 0 available. This used to invent a
      // 1000 SMS / 500 email allowance shown as 100% available.
      // Percentage Available = ((Monthly Limit - Current Usage) / Monthly Limit) × 100
      const smsLimit = smsData ? (smsData.monthly_limit + (smsData.additional_sms_purchased || 0)) : 0;
      const smsUsage = smsData?.current_usage || 0;
      const smsAvailable = Math.max(0, smsLimit - smsUsage);
      const smsPercentageAvailable = smsLimit > 0 ? Math.round((smsAvailable / smsLimit) * 100) : 0;

      const emailLimit = emailData ? (emailData.monthly_limit + (emailData.additional_emails_purchased || 0)) : 0;
      const emailUsage = emailData?.current_usage || 0;
      const emailAvailable = Math.max(0, emailLimit - emailUsage);
      const emailPercentageAvailable = emailLimit > 0 ? Math.round((emailAvailable / emailLimit) * 100) : 0;

      // Calculate overall percentage available (average of both services)
      const overallPercentageAvailable = Math.round((smsPercentageAvailable + emailPercentageAvailable) / 2);

      console.log('📊 Calculated communication stats:');
      console.log(`📱 SMS: ${smsUsage}/${smsLimit} used, ${smsAvailable} available (${smsPercentageAvailable}%)`);
      console.log(`📧 Email: ${emailUsage}/${emailLimit} used, ${emailAvailable} available (${emailPercentageAvailable}%)`);
      console.log(`📈 Overall availability: ${overallPercentageAvailable}%`);

      return {
        sms: {
          current_usage: smsUsage,
          monthly_limit: smsLimit,
          percentage_available: smsPercentageAvailable,
          available: smsAvailable
        },
        email: {
          current_usage: emailUsage,
          monthly_limit: emailLimit,
          percentage_available: emailPercentageAvailable,
          available: emailAvailable
        },
        overall_percentage_available: overallPercentageAvailable
      };

    } catch (error) {
      console.error('❌ Error fetching communication stats:', error);
      // Let callers show that the numbers could not be loaded, instead of the made-up
      // 150/1000 SMS and 40/500 emails this used to return
      throw error;
    }
  }
}