import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationTrigger {
  id: string;
  name: string;
  description: string;
  event_type: string;
  conditions: Record<string, unknown>;
  notification_type: string;
  template: string;
  enabled: boolean;
  icon: string;
  color: string;
}

const defaultTriggers: Omit<NotificationTrigger, 'id'>[] = [
  {
    name: 'Lab Results Ready',
    description: 'Notify when lab results are uploaded and ready for review',
    event_type: 'lab_results_uploaded',
    conditions: { result_status: 'completed' },
    notification_type: 'lab_results',
    template: 'Your lab results for {{test_name}} are ready. Click to view.',
    enabled: true,
    icon: 'solar:test-tube-minimalistic-bold-duotone',
    color: 'purple'
  },
  {
    name: 'Visit Status Change',
    description: 'Alert when patient visit status changes (checked-in, in-progress, completed)',
    event_type: 'visit_status_changed',
    conditions: { status_transitions: ['scheduled', 'checked_in', 'in_progress', 'completed'] },
    notification_type: 'visit_status',
    template: 'Visit status updated: {{patient_name}} is now {{new_status}}',
    enabled: true,
    icon: 'solar:stethoscope-bold-duotone',
    color: 'blue'
  },
  {
    name: 'Appointment Reminder',
    description: 'Send reminder before scheduled appointments',
    event_type: 'appointment_upcoming',
    conditions: { hours_before: 24 },
    notification_type: 'appointment_reminder',
    template: 'Reminder: {{patient_name}} has an appointment tomorrow at {{appointment_time}}',
    enabled: true,
    icon: 'solar:calendar-mark-bold-duotone',
    color: 'green'
  },
  {
    name: 'Critical Lab Values',
    description: 'Immediate alert for critical lab result values',
    event_type: 'critical_lab_value',
    conditions: { priority: 'critical' },
    notification_type: 'critical_result',
    template: '⚠️ CRITICAL: {{patient_name}} - {{test_name}}: {{result_value}} {{unit}}',
    enabled: true,
    icon: 'solar:danger-triangle-bold-duotone',
    color: 'red'
  },
  {
    name: 'Payment Received',
    description: 'Notify when patient payment is processed',
    event_type: 'payment_processed',
    conditions: { payment_status: 'successful' },
    notification_type: 'payment_received',
    template: 'Payment received from {{patient_name}}: {{amount}} for Invoice #{{invoice_number}}',
    enabled: true,
    icon: 'solar:dollar-minimalistic-bold-duotone',
    color: 'emerald'
  },
  {
    name: 'Follow-up Due',
    description: 'Alert when patient follow-up is due based on last visit',
    event_type: 'follow_up_due',
    conditions: { days_after_visit: 7 },
    notification_type: 'follow_up',
    template: 'Follow-up due: {{patient_name}} - Last visit {{days_ago}} days ago',
    enabled: true,
    icon: 'solar:bell-bing-bold-duotone',
    color: 'orange'
  },
  {
    name: 'Prescription Renewal',
    description: 'Notify when prescription renewal is needed',
    event_type: 'prescription_expiring',
    conditions: { days_before_expiry: 7 },
    notification_type: 'prescription_renewal',
    template: 'Prescription renewal needed: {{patient_name}} - {{medication_name}}',
    enabled: true,
    icon: 'solar:pills-3-bold-duotone',
    color: 'cyan'
  },
  {
    name: 'Task Assignment',
    description: 'Alert when new task is assigned',
    event_type: 'task_assigned',
    conditions: { assigned_to: 'current_user' },
    notification_type: 'task_assigned',
    template: 'New task assigned: {{task_title}} - Due {{due_date}}',
    enabled: true,
    icon: 'solar:checklist-bold-duotone',
    color: 'indigo'
  }
];

export const NotificationTriggers: React.FC = () => {
  const { user } = useAuthStore();
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);

  useEffect(() => {
    if (user?.practice_id) {
      loadTriggers();
    }
  }, [user?.practice_id]);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_triggers')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');

      if (error) throw error;

      // If no triggers exist, create defaults
      if (!data || data.length === 0) {
        await createDefaultTriggers();
      } else {
        setTriggers(data);
      }
    } catch (error) {
      console.error('Error loading triggers:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTriggers = async () => {
    try {
      const newTriggers = defaultTriggers.map(trigger => ({
        ...trigger,
        practice_id: user?.practice_id,
        created_by: user?.id
      }));

      const { data, error } = await supabase
        .from('notification_triggers')
        .insert(newTriggers)
        .select();

      if (error) throw error;
      setTriggers(data || []);
    } catch (error) {
      console.error('Error creating default triggers:', error);
    }
  };

  const updateTrigger = async (triggerId: string, updates: Partial<NotificationTrigger>) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('notification_triggers')
        .update(updates)
        .eq('id', triggerId);

      if (error) throw error;

      setTriggers(prev => prev.map(t => 
        t.id === triggerId ? { ...t, ...updates } : t
      ));
    } catch (error) {
      console.error('Error updating trigger:', error);
    } finally {
      setSaving(false);
    }
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
      green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
      red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' }
    };
    return colorMap[color] || colorMap.blue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Notification Triggers</h2>
        <p className="text-gray-600">Configure smart triggers for automatic notifications based on system events</p>
      </div>

      <div className="grid gap-4">
        {triggers.map((trigger) => {
          const colorClasses = getColorClasses(trigger.color);
          const isExpanded = expandedTrigger === trigger.id;

          return (
            <motion.div
              key={trigger.id}
              layout
              className={cn(
                "bg-white rounded-xl shadow-sm border overflow-hidden transition-all",
                colorClasses.border
              )}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "p-3 rounded-lg flex-shrink-0",
                    colorClasses.bg
                  )}>
                    <Icon 
                      icon={trigger.icon} 
                      className={cn("w-6 h-6", colorClasses.text)}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{trigger.name}</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={trigger.enabled}
                          onChange={(e) => updateTrigger(trigger.id, { enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#01b9d5]"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{trigger.description}</p>

                    {/* Template Preview */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Notification Template:</p>
                      <p className="text-sm text-gray-600 font-mono">{trigger.template}</p>
                    </div>

                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => setExpandedTrigger(isExpanded ? null : trigger.id)}
                      className="text-sm text-[#01b9d5] hover:text-[#0197a4] flex items-center gap-1"
                    >
                      <Icon 
                        icon={isExpanded ? "solar:alt-arrow-up-bold-duotone" : "solar:alt-arrow-down-bold-duotone"} 
                        className="w-4 h-4"
                      />
                      {isExpanded ? 'Hide' : 'Show'} advanced settings
                    </button>
                  </div>
                </div>

                {/* Advanced Settings */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                        {/* Event Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Event Type
                          </label>
                          <input
                            type="text"
                            value={trigger.event_type}
                            readOnly
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>

                        {/* Conditions */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Trigger Conditions
                          </label>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <pre className="text-xs text-gray-600 overflow-x-auto">
                              {JSON.stringify(trigger.conditions, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Template Editor */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notification Template
                          </label>
                          <textarea
                            value={trigger.template}
                            onChange={(e) => updateTrigger(trigger.id, { template: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                            rows={3}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Available variables: {'{{patient_name}}'}, {'{{test_name}}'}, {'{{appointment_time}}'}, etc.
                          </p>
                        </div>

                        <button
                          onClick={() => setExpandedTrigger(null)}
                          disabled={saving}
                          className="w-full py-2 bg-[#01b9d5] text-white rounded-lg hover:bg-[#0197a4] disabled:opacity-50 text-sm font-medium"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};