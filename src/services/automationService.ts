import { supabase } from '../lib/supabase';

export interface AutomationSettings {
  id?: string;
  practice_id: string;
  automation_id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  is_active: boolean;
  channels: ChannelConfig[];
  timings: TimingConfig[];
  sms_template?: any;
  email_template?: any;
  variables?: string[];
  trigger_config?: any;
  conditions?: any;
}

export interface ChannelConfig {
  type: 'SMS' | 'EMAIL' | 'BOTH';
  enabled: boolean;
  template?: {
    subject?: string;
    body: string;
  };
}

export interface TimingConfig {
  id: string;
  label?: string;
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  when: 'before' | 'after';
  enabled: boolean;
}

export interface AutomationExecution {
  id: string;
  automation_id: string;
  practice_id: string;
  patient_id?: string;
  visit_id?: string;
  invoice_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduled_at: string;
  executed_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  message_id?: string;
  channel?: 'SMS' | 'EMAIL';
}

export interface AutomationStats {
  total_sent: number;
  success_rate: number;
  pending_count: number;
  failed_count: number;
  by_type: Record<string, number>;
  by_channel: {
    sms: number;
    email: number;
  };
}

class AutomationService {
  /**
   * Get all automation settings for a practice
   */
  async getAutomationSettings(practiceId: string): Promise<AutomationSettings[]> {
    const { data, error } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('practice_id', practiceId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single automation setting
   */
  async getAutomationSetting(practiceId: string, automationId: string): Promise<AutomationSettings | null> {
    const { data, error } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('automation_id', automationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Create or update automation settings
   */
  async upsertAutomationSettings(settings: AutomationSettings): Promise<AutomationSettings> {
    const { data, error } = await supabase
      .from('automation_settings')
      .upsert({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete automation settings
   */
  async deleteAutomationSettings(practiceId: string, automationId: string): Promise<void> {
    const { error } = await supabase
      .from('automation_settings')
      .delete()
      .eq('practice_id', practiceId)
      .eq('automation_id', automationId);

    if (error) throw error;
  }

  /**
   * Toggle automation active status
   */
  async toggleAutomation(practiceId: string, automationId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('automation_settings')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('practice_id', practiceId)
      .eq('automation_id', automationId);

    if (error) throw error;
  }

  /**
   * Get automation execution history
   */
  async getExecutionHistory(
    practiceId: string, 
    options?: {
      automationId?: string;
      patientId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<AutomationExecution[]> {
    let query = supabase
      .from('automation_executions')
      .select(`
        *,
        automation:automation_settings(name, icon),
        patient:patients(first_name, last_name)
      `)
      .eq('practice_id', practiceId)
      .order('scheduled_at', { ascending: false });

    if (options?.automationId) {
      query = query.eq('automation_id', options.automationId);
    }
    if (options?.patientId) {
      query = query.eq('patient_id', options.patientId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.startDate) {
      query = query.gte('scheduled_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('scheduled_at', options.endDate);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get automation statistics
   */
  async getAutomationStats(practiceId: string, days: number = 30): Promise<AutomationStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: executions, error } = await supabase
      .from('automation_executions')
      .select('status, channel, automation_id')
      .eq('practice_id', practiceId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const stats: AutomationStats = {
      total_sent: 0,
      success_rate: 0,
      pending_count: 0,
      failed_count: 0,
      by_type: {},
      by_channel: {
        sms: 0,
        email: 0
      }
    };

    if (executions) {
      stats.total_sent = executions.length;
      stats.pending_count = executions.filter(e => e.status === 'pending').length;
      stats.failed_count = executions.filter(e => e.status === 'failed').length;
      
      const completed = executions.filter(e => e.status === 'completed').length;
      stats.success_rate = stats.total_sent > 0 ? (completed / stats.total_sent) * 100 : 0;

      // Count by channel
      executions.forEach(e => {
        if (e.channel === 'SMS') stats.by_channel.sms++;
        if (e.channel === 'EMAIL') stats.by_channel.email++;
        
        // Count by type
        if (e.automation_id) {
          stats.by_type[e.automation_id] = (stats.by_type[e.automation_id] || 0) + 1;
        }
      });
    }

    return stats;
  }

  /**
   * Cancel pending automation execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const { error } = await supabase
      .from('automation_executions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId)
      .eq('status', 'pending');

    if (error) throw error;
  }

  /**
   * Retry failed automation execution
   */
  async retryExecution(executionId: string): Promise<void> {
    const { error } = await supabase
      .from('automation_executions')
      .update({ 
        status: 'pending',
        scheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId)
      .eq('status', 'failed');

    if (error) throw error;
  }

  /**
   * Test automation with sample data
   */
  async testAutomation(
    practiceId: string, 
    automationId: string, 
    testData: {
      patientEmail?: string;
      patientPhone?: string;
      variables?: Record<string, string>;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get automation settings
      const settings = await this.getAutomationSetting(practiceId, automationId);
      if (!settings) {
        throw new Error('Automation not found');
      }

      // Create a test execution
      const { data, error } = await supabase
        .from('automation_executions')
        .insert({
          automation_id: settings.id,
          practice_id: practiceId,
          scheduled_at: new Date().toISOString(),
          status: 'pending',
          template_data: {
            ...testData.variables,
            test_mode: true,
            test_email: testData.patientEmail,
            test_phone: testData.patientPhone
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger the automation engine
      const { error: invokeError } = await supabase.functions.invoke('automation-engine');
      
      if (invokeError) throw invokeError;

      return {
        success: true,
        message: 'Test automation has been queued for processing'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to test automation'
      };
    }
  }

  /**
   * Get available variables for an automation type
   */
  getAvailableVariables(automationType: string): string[] {
    const baseVariables = [
      'patientName',
      'practiceName',
      'practicePhone',
      'practiceWebsite',
      'practiceEmail'
    ];

    const typeSpecificVariables: Record<string, string[]> = {
      'appointment-reminder': [
        'appointmentDate',
        'appointmentTime',
        'doctorName',
        'visitType',
        'confirmationCode'
      ],
      'payment-reminder': [
        'invoiceNumber',
        'amount',
        'dueDate',
        'paymentLink',
        'daysOverdue'
      ],
      'lab-results': [
        'testDate',
        'testType',
        'resultsLink',
        'doctorName'
      ],
      'birthday-wishes': [
        'patientAge',
        'birthdayOffer',
        'specialDiscount'
      ],
      'follow-up': [
        'visitDate',
        'followUpInstructions',
        'nextAppointmentDate',
        'medicationReminders'
      ]
    };

    return [
      ...baseVariables,
      ...(typeSpecificVariables[automationType] || [])
    ];
  }
}

export const automationService = new AutomationService();