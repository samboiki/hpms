import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import { format, addDays, addWeeks, addMonths, parseISO } from 'date-fns';

type FollowUpTemplate = Database['public']['Tables']['follow_up_templates']['Row'];
type Visit = Database['public']['Tables']['visits']['Row'];

interface TemplateStep {
  step_number: number;
  interval_value: number;
  interval_unit: string;
  visit_type: string;
  notes_template: string;
  services_to_schedule: string[];
}

interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedVisit: Visit;
  patientId: string;
  practiceId: string;
  branchId?: string | null;
}

export default function ScheduleFollowUpModal({
  isOpen,
  onClose,
  completedVisit,
  patientId,
  practiceId,
  branchId,
}: ScheduleFollowUpModalProps) {
  const user = useAuthStore((s) => s.user);
  const [templates, setTemplates] = useState<FollowUpTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FollowUpTemplate | null>(null);
  const [eddDate, setEddDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, practiceId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      const { data: templatesData, error } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;

      setTemplates(templatesData || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load follow-up templates');
    } finally {
      setLoading(false);
    }
  };

  const calculateFollowUpDate = (baseDate: Date, intervalValue: number, intervalUnit: string): Date => {
    switch (intervalUnit) {
      case 'Days':
        return addDays(baseDate, intervalValue);
      case 'Weeks':
        return addWeeks(baseDate, intervalValue);
      case 'Months':
        return addMonths(baseDate, intervalValue);
      default:
        return baseDate;
    }
  };

  const calculateGestationDate = (edd: Date, weeksGestation: number): Date => {
    // EDD is at 40 weeks, so we calculate backwards
    const daysFromEdd = (40 - weeksGestation) * 7;
    return addDays(edd, -daysFromEdd);
  };

  const scheduleFollowUp = async () => {
    if (!selectedTemplate) return;

    setScheduling(true);

    try {
      const steps = selectedTemplate.steps as TemplateStep[];
      
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('Invalid template configuration');
      }

      // For ANC templates with weeks_gestation, we need the EDD
      const hasGestationSteps = steps.some(s => s.interval_unit === 'weeks_gestation');
      if (hasGestationSteps && !eddDate) {
        toast.error('Please enter the Estimated Due Date (EDD)');
        setScheduling(false);
        return;
      }

      const visitsToCreate = [];
      const baseDate = new Date();
      const edd = eddDate ? parseISO(eddDate) : new Date();

      // Create only the first visit for manual application
      const firstStep = steps[0];
      let scheduledDate: Date;
      
      if (firstStep.interval_unit === 'weeks_gestation') {
        scheduledDate = calculateGestationDate(edd, firstStep.interval_value);
      } else {
        scheduledDate = calculateFollowUpDate(baseDate, firstStep.interval_value, firstStep.interval_unit);
      }

      // Replace {trigger_value} in notes template
      const notes = firstStep.notes_template?.replace('{trigger_value}', selectedTemplate.trigger_value) || '';

      const { error } = await supabase
        .from('visits')
        .insert({
          patient_id: patientId,
          practice_id: practiceId,
          branch_id: branchId,
          doctor_id: user?.id,
          visit_type: firstStep.visit_type || 'Follow-up',
          scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
          scheduled_time: '09:00:00', // Default time
          status: 'scheduled',
          notes: notes,
          preceding_visit_id: completedVisit.id,
          applied_template_id: selectedTemplate.id,
          care_plan_step: 1,
          is_scheduled: true,
        });

      if (error) throw error;

      toast.success(`Follow-up visit scheduled for ${format(scheduledDate, 'MMM d, yyyy')}`);
      onClose();
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      toast.error('Failed to schedule follow-up visit');
    } finally {
      setScheduling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Schedule Follow-up Visit</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <Icon icon="solar:document-bold-duotone" className="w-12 h-12 mx-auto text-gray-300" />
              <p className="text-gray-500 mt-2">No active follow-up templates available</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Follow-up Template
                </label>
                <div className="space-y-2">
                  {templates.map((template) => {
                    const steps = template.steps as TemplateStep[];
                    const stepCount = Array.isArray(steps) ? steps.length : 0;
                    
                    return (
                      <div
                        key={template.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{template.template_name}</h4>
                            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                stepCount > 1 ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {stepCount > 1 ? 'Multi-step Plan' : 'Single Follow-up'}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                template.trigger_type === 'DIAGNOSIS' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {template.trigger_type}: {template.trigger_value}
                              </span>
                              <span>
                                {stepCount} {stepCount === 1 ? 'visit' : 'visits'}
                              </span>
                            </div>
                          </div>
                          <div>
                            {selectedTemplate?.id === template.id && (
                              <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-blue-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedTemplate && (
                <>
                  {/* Show EDD input for ANC templates */}
                  {(() => {
                    const steps = selectedTemplate.steps as TemplateStep[];
                    const hasGestationSteps = steps.some(s => s.interval_unit === 'weeks_gestation');
                    
                    return hasGestationSteps ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Estimated Due Date (EDD)
                        </label>
                        <input
                          type="date"
                          value={eddDate}
                          onChange={(e) => setEddDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          The EDD will be used to calculate the antenatal visit date
                        </p>
                      </div>
                    ) : null;
                  })()}

                  {/* Visit Schedule Preview */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Next Visit to Schedule</h4>
                    {(() => {
                      const steps = selectedTemplate.steps as TemplateStep[];
                      const firstStep = steps[0];
                      
                      let scheduledDate: Date | null = null;
                      
                      if (firstStep.interval_unit === 'weeks_gestation' && eddDate) {
                        scheduledDate = calculateGestationDate(parseISO(eddDate), firstStep.interval_value);
                      } else if (firstStep.interval_unit !== 'weeks_gestation') {
                        scheduledDate = calculateFollowUpDate(new Date(), firstStep.interval_value, firstStep.interval_unit);
                      }

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              {firstStep.visit_type || 'Follow-up Visit'}
                            </span>
                            <span className="text-gray-500">
                              {firstStep.interval_unit === 'weeks_gestation' && !eddDate ? (
                                'Enter EDD to see date'
                              ) : scheduledDate ? (
                                format(scheduledDate, 'MMM d, yyyy')
                              ) : (
                                'Date not available'
                              )}
                            </span>
                          </div>
                          {firstStep.notes_template && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">Notes:</span> {firstStep.notes_template.replace('{trigger_value}', selectedTemplate.trigger_value)}
                            </div>
                          )}
                          {firstStep.services_to_schedule && firstStep.services_to_schedule.length > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Services:</span> {firstStep.services_to_schedule.join(', ')}
                            </div>
                          )}
                          {steps.length > 1 && (
                            <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                              <Icon icon="solar:info-circle-bold-duotone" className="inline w-4 h-4 mr-1" />
                              This is step 1 of {steps.length} in the care plan. Additional visits will be scheduled automatically as each step is completed.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={scheduleFollowUp}
            disabled={!selectedTemplate || scheduling || (() => {
              if (!selectedTemplate) return true;
              const steps = selectedTemplate.steps as TemplateStep[];
              const hasGestationSteps = steps.some(s => s.interval_unit === 'weeks_gestation');
              return hasGestationSteps && !eddDate;
            })()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {scheduling && <Icon icon="solar:spinner-bold-duotone" className="w-4 h-4 animate-spin" />}
            Schedule Follow-up
          </button>
        </div>
      </div>
    </div>
  );
}