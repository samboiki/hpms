import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

type FollowUpTemplate = Database['public']['Tables']['follow_up_templates']['Row'];

interface TemplateStep {
  step_number: number;
  interval_value: number;
  interval_unit: string;
  visit_type: string;
  notes_template: string;
  services_to_schedule: string[];
}

export default function FollowUpAutomation() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<FollowUpTemplate[]>([]);
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FollowUpTemplate | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load only
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (user?.id && !practiceId && isMounted) {
        await fetchPracticeSettings();
        await fetchTemplates();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  const fetchPracticeSettings = useCallback(async () => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // SECURITY: Users can ONLY access their assigned practice from users table
      if (!user.practice_id) {
        throw new Error('No practice assigned to this user. Please contact your administrator.');
      }

      const practiceIdToUse = user.practice_id;
      setPracticeId(practiceIdToUse);

      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('is_follow_up_automation_enabled')
        .eq('id', practiceIdToUse)
        .single();

      if (practiceError) {
        console.error('Practice error:', practiceError);
        throw practiceError;
      }
      
      setIsAutomationEnabled(practiceData.is_follow_up_automation_enabled || false);
    } catch (error) {
      console.error('Error fetching practice settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load practice settings';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // SECURITY: Only use practice_id from authenticated user record
      const practiceIdToUse = practiceId || user.practice_id;

      if (!practiceIdToUse) {
        throw new Error('No practice assigned to this user');
      }

      const { data: templatesData, error: templatesError } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('practice_id', practiceIdToUse)
        .order('template_name');

      if (templatesError) {
        console.error('Templates error:', templatesError);
        throw templatesError;
      }

      setTemplates(templatesData || []);
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching templates:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load templates';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [practiceId, user]);

  const toggleAutomation = useCallback(async () => {
    try {
      if (!practiceId) return;

      const newValue = !isAutomationEnabled;
      
      const { error } = await supabase
        .from('practices')
        .update({ is_follow_up_automation_enabled: newValue })
        .eq('id', practiceId);

      if (error) throw error;

      setIsAutomationEnabled(newValue);
      toast.success(newValue ? 'Automation enabled' : 'Automation disabled');
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast.error('Failed to update automation setting');
    }
  }, [isAutomationEnabled, practiceId]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('follow_up_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  }, [fetchTemplates]);

  const toggleTemplateActive = useCallback(async (templateId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('follow_up_templates')
        .update({ is_active: !currentStatus })
        .eq('id', templateId);

      if (error) throw error;

      toast.success(currentStatus ? 'Template deactivated' : 'Template activated');
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template status:', error);
      toast.error('Failed to update template status');
    }
  }, [fetchTemplates]);

  const generateAITemplates = useCallback(async () => {
    if (!practiceId) return;
    
    setAiGenerating(true);
    try {
      // Fetch practice type and tariffs
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('practice_type, practice_type_id, practice_types!inner(name)')
        .eq('id', practiceId)
        .single();

      if (practiceError) throw practiceError;

      // Fetch tariffs for this practice type
      const { data: tariffsData, error: tariffsError } = await supabase
        .from('practice_tariffs')
        .select('code, description')
        .eq('practice_type_id', practiceData.practice_type_id)
        .eq('is_active', true)
        .order('code');

      if (tariffsError) throw tariffsError;

      // Call Edge Function to generate templates
      const { data, error } = await supabase.functions.invoke('generate-follow-up-templates', {
        body: {
          practiceId,
          practiceType: practiceData.practice_type,
          practiceTypeName: practiceData.practice_types?.name,
          tariffs: tariffsData || []
        }
      });

      if (error) throw error;

      // Insert generated templates
      if (data?.templates && Array.isArray(data.templates)) {
        interface AIGeneratedTemplate {
          template_name: string;
          trigger_type: 'DIAGNOSIS' | 'TARIFF_CODE';
          trigger_value: string;
          steps: TemplateStep[];
        }
        const templatesToInsert = data.templates.map((template: AIGeneratedTemplate) => ({
          practice_id: practiceId,
          template_name: template.template_name,
          trigger_type: template.trigger_type,
          trigger_value: template.trigger_value,
          steps: template.steps,
          is_active: false // Start as inactive
        }));

        const { error: insertError } = await supabase
          .from('follow_up_templates')
          .insert(templatesToInsert);

        if (insertError) throw insertError;

        toast.success(`Generated ${data.templates.length} AI templates. Review and activate as needed.`);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error generating AI templates:', error);
      toast.error('Failed to generate AI templates');
    } finally {
      setAiGenerating(false);
    }
  }, [practiceId, fetchTemplates]);

  // Memoize template rows to prevent re-renders
  const templateRows = useMemo(() => {
    return templates.map((template) => {
      const steps = template.steps as TemplateStep[];
      const stepCount = Array.isArray(steps) ? steps.length : 0;
      return { template, steps, stepCount };
    });
  }, [templates]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Icon icon="solar:spinner-bold-duotone" className="w-12 h-12 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-4">Loading follow-up automation settings...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="w-12 h-12 mx-auto text-red-500" />
          <p className="text-gray-700 mt-4 font-medium">Error loading follow-up automation</p>
          <p className="text-gray-500 mt-2">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchPracticeSettings();
              fetchTemplates();
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show no user state
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Icon icon="solar:user-bold-duotone" className="w-12 h-12 mx-auto text-gray-400" />
          <p className="text-gray-500 mt-4">Please log in to manage follow-up automations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Control Switch */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Backend Automation Engine</h3>
            <p className="text-sm text-gray-600 mt-1">
              When enabled, the system will automatically create follow-up visits based on completed visit data
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isAutomationEnabled}
              onChange={toggleAutomation}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Templates Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Follow-up Templates</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={generateAITemplates}
                disabled={aiGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon icon={aiGenerating ? "solar:spinner-bold-duotone" : "solar:magic-stick-3-bold-duotone"} 
                      className={`w-5 h-5 ${aiGenerating ? 'animate-spin' : ''}`} />
                {aiGenerating ? 'Generating...' : '✨ Generate AI Suggestions'}
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                Create New Template
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-6 text-center">
            <Icon icon="solar:document-bold-duotone" className="w-12 h-12 mx-auto text-gray-300" />
            <p className="text-gray-500 mt-2">No templates created yet</p>
            <p className="text-gray-400 text-sm mt-1">Click "Generate AI Suggestions" to get started quickly</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Steps
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templateRows.map(({ template, stepCount }) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{template.template_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          stepCount > 1 ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {stepCount > 1 ? 'Multi-step Plan' : 'Single Follow-up'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            template.trigger_type === 'DIAGNOSIS' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {template.trigger_type}
                          </span>
                          <span className="text-gray-700">{template.trigger_value}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleTemplateActive(template.id, template.is_active)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            template.is_active 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {template.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowCreateModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <TemplateModal
          template={editingTemplate}
          practiceId={practiceId!}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

interface TemplateModalProps {
  template: FollowUpTemplate | null;
  practiceId: string;
  onClose: () => void;
  onSave: () => void;
}

function TemplateModal({ template, practiceId, onClose, onSave }: TemplateModalProps) {
  const existingSteps = template?.steps as TemplateStep[] | null;
  
  const [formData, setFormData] = useState({
    template_name: template?.template_name || '',
    trigger_type: template?.trigger_type || 'DIAGNOSIS',
    trigger_value: template?.trigger_value || '',
    is_active: template?.is_active ?? false,
  });

  const [steps, setSteps] = useState<TemplateStep[]>(
    existingSteps || [
      {
        step_number: 1,
        interval_value: 7,
        interval_unit: 'Days',
        visit_type: 'Follow-up',
        notes_template: '',
        services_to_schedule: [],
      },
    ]
  );

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const templateData = {
        practice_id: practiceId,
        template_name: formData.template_name,
        trigger_type: formData.trigger_type,
        trigger_value: formData.trigger_value,
        steps: steps,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (template) {
        // Update existing template
        const { error } = await supabase
          .from('follow_up_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) throw error;
      } else {
        // Create new template
        const { error } = await supabase
          .from('follow_up_templates')
          .insert(templateData);

        if (error) throw error;
      }

      toast.success(template ? 'Template updated successfully' : 'Template created successfully');
      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_number: steps.length + 1,
        interval_value: 7,
        interval_unit: 'Days',
        visit_type: 'Follow-up',
        notes_template: '',
        services_to_schedule: [],
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length === 1) {
      toast.error('Template must have at least one step');
      return;
    }
    
    const newSteps = steps.filter((_, i) => i !== index);
    // Renumber steps
    setSteps(
      newSteps.map((step, i) => ({
        ...step,
        step_number: i + 1,
      }))
    );
  };

  const updateStep = (index: number, field: keyof TemplateStep, value: number | string | string[]) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const updateServices = (index: number, servicesString: string) => {
    const services = servicesString.split(',').map(s => s.trim()).filter(s => s);
    updateStep(index, 'services_to_schedule', services);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {template ? 'Edit Template' : 'Create New Template'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                required
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Post-Extraction Healing Check"
              />
            </div>

            {/* Trigger Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Type
                </label>
                <select
                  value={formData.trigger_type}
                  onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as 'DIAGNOSIS' | 'TARIFF_CODE' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="DIAGNOSIS">Diagnosis</option>
                  <option value="TARIFF_CODE">Tariff Code</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Value
                </label>
                <input
                  type="text"
                  required
                  value={formData.trigger_value}
                  onChange={(e) => setFormData({ ...formData, trigger_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder={formData.trigger_type === 'DIAGNOSIS' ? 'e.g., Type 2 Diabetes' : 'e.g., 8210'}
                />
              </div>
            </div>

            {/* Steps Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Follow-up Steps</h4>
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
                  Add Step
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900">Step {step.step_number}</h5>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Interval
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={step.interval_value}
                          onChange={(e) => updateStep(index, 'interval_value', parseInt(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <select
                          value={step.interval_unit}
                          onChange={(e) => updateStep(index, 'interval_unit', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Days">Days</option>
                          <option value="Weeks">Weeks</option>
                          <option value="Months">Months</option>
                          <option value="weeks_gestation">Weeks Gestation</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Visit Type
                        </label>
                        <input
                          type="text"
                          value={step.visit_type}
                          onChange={(e) => updateStep(index, 'visit_type', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Follow-up"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Notes Template
                          <Icon icon="solar:info-circle-bold-duotone" className="inline-block w-3 h-3 ml-1 text-gray-400" />
                        </label>
                        <textarea
                          value={step.notes_template}
                          onChange={(e) => updateStep(index, 'notes_template', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                          placeholder="Pre-filled notes for this visit. Use {trigger_value} to insert the trigger value."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This text will be pre-filled in the visit notes. Use {'{trigger_value}'} to insert the diagnosis or tariff code that triggered this follow-up.
                          <br />
                          Example: "Follow-up for {'{trigger_value}'}. Check healing progress."
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Services to Schedule (comma-separated tariff codes)
                          <Icon icon="solar:info-circle-bold-duotone" className="inline-block w-3 h-3 ml-1 text-gray-400" />
                        </label>
                        <input
                          type="text"
                          value={step.services_to_schedule.join(', ')}
                          onChange={(e) => updateServices(index, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., 8104, 8105"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tariff codes for services that should be automatically scheduled during this follow-up visit.
                          <br />
                          These will appear as line items in the invoice. Leave empty if no specific services needed.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Template is active
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Icon icon="solar:spinner-bold-duotone" className="w-4 h-4 animate-spin" />}
              {template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}