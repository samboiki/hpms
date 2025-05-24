import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Edit3, 
  Trash2,
  Play,
  Pause,
  Clock,
  Calendar,
  Bell,
  FileText,
  ChevronRight,
  Settings,
  X,
  Save,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface Workflow {
  id?: string;
  name: string;
  description?: string;
  trigger_event_type: string;
  trigger_condition_json?: any;
  communication_type: 'EMAIL' | 'SMS';
  template_id?: string;
  offset_value: number;
  offset_unit: 'HOURS' | 'DAYS' | 'MINUTES';
  offset_direction: 'BEFORE' | 'AFTER' | 'IMMEDIATE';
  send_time_of_day?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const TRIGGER_EVENTS = [
  { value: 'APPOINTMENT_SCHEDULED', label: 'Appointment Scheduled', icon: Calendar },
  { value: 'APPOINTMENT_REMINDER', label: 'Appointment Reminder', icon: Bell },
  { value: 'PATIENT_BIRTHDAY', label: 'Patient Birthday', icon: Calendar },
  { value: 'INVOICE_GENERATED', label: 'Invoice Generated', icon: FileText },
  { value: 'INVOICE_DUE', label: 'Invoice Due', icon: AlertCircle },
  { value: 'POST_APPOINTMENT', label: 'Post Appointment Follow-up', icon: Clock },
];

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  const [formData, setFormData] = useState<Workflow>({
    name: '',
    description: '',
    trigger_event_type: 'APPOINTMENT_REMINDER',
    communication_type: 'EMAIL',
    template_id: '',
    offset_value: 24,
    offset_unit: 'HOURS',
    offset_direction: 'BEFORE',
    send_time_of_day: '09:00',
    is_active: true
  });

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Workflow name is required';
    }

    if (!formData.template_id) {
      newErrors.template_id = 'Please select a template';
    }

    if (formData.offset_value < 0) {
      newErrors.offset_value = 'Offset value must be positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const workflowData = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      if (editingWorkflow) {
        const { error } = await supabase
          .from('workflows')
          .update(workflowData)
          .eq('id', editingWorkflow.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workflows')
          .insert(workflowData);

        if (error) throw error;
      }

      await fetchWorkflows();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Failed to save workflow. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Failed to delete workflow. Please try again.');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchWorkflows();
    } catch (error) {
      console.error('Error updating workflow status:', error);
      alert('Failed to update workflow status. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingWorkflow(null);
    setFormData({
      name: '',
      description: '',
      trigger_event_type: 'APPOINTMENT_REMINDER',
      communication_type: 'EMAIL',
      template_id: '',
      offset_value: 24,
      offset_unit: 'HOURS',
      offset_direction: 'BEFORE',
      send_time_of_day: '09:00',
      is_active: true
    });
    setErrors({});
  };

  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setFormData(workflow);
    setShowModal(true);
  };

  const getWorkflowDescription = (workflow: Workflow) => {
    const trigger = TRIGGER_EVENTS.find(t => t.value === workflow.trigger_event_type);
    const template = templates.find(t => t.id === workflow.template_id);
    
    let timing = '';
    if (workflow.offset_direction === 'IMMEDIATE') {
      timing = 'immediately';
    } else {
      timing = `${workflow.offset_value} ${workflow.offset_unit.toLowerCase()} ${workflow.offset_direction.toLowerCase()}`;
      if (workflow.send_time_of_day && workflow.offset_unit !== 'MINUTES') {
        timing += ` at ${workflow.send_time_of_day}`;
      }
    }

    return `Send ${workflow.communication_type} using "${template?.name || 'Unknown template'}" ${timing} ${trigger?.label.toLowerCase()}`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Automated Workflows</h1>
          <p className="text-gray-600 mt-1">Set up automated messaging workflows</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowModal(true)}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </motion.button>
      </div>

      {/* Workflows List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No workflows configured</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowModal(true)}
            className="text-primary-500 hover:text-primary-600"
          >
            Create your first workflow
          </motion.button>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => {
            const trigger = TRIGGER_EVENTS.find(t => t.value === workflow.trigger_event_type);
            const TriggerIcon = trigger?.icon || Zap;
            const isExpanded = expandedWorkflow === workflow.id;

            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        workflow.is_active ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <TriggerIcon className={`w-5 h-5 ${
                          workflow.is_active ? 'text-primary-600' : 'text-gray-600'
                        }`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            workflow.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {workflow.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            workflow.communication_type === 'EMAIL'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {workflow.communication_type}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {getWorkflowDescription(workflow)}
                        </p>
                        
                        {workflow.description && (
                          <p className="text-sm text-gray-500">{workflow.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleToggleActive(workflow.id!, workflow.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          workflow.is_active
                            ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                            : 'text-primary-600 hover:text-primary-700 hover:bg-primary-50'
                        }`}
                        title={workflow.is_active ? 'Pause workflow' : 'Activate workflow'}
                      >
                        {workflow.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(workflow)}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(workflow.id!)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setExpandedWorkflow(isExpanded ? null : workflow.id!)}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`} />
                      </motion.button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-4 border-t border-gray-100">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Trigger</p>
                              <p className="font-medium text-gray-900">{trigger?.label}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Template</p>
                              <p className="font-medium text-gray-900">
                                {templates.find(t => t.id === workflow.template_id)?.name || 'Unknown'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Timing</p>
                              <p className="font-medium text-gray-900">
                                {workflow.offset_direction === 'IMMEDIATE' 
                                  ? 'Immediately'
                                  : `${workflow.offset_value} ${workflow.offset_unit.toLowerCase()} ${workflow.offset_direction.toLowerCase()}`
                                }
                              </p>
                            </div>
                            {workflow.send_time_of_day && (
                              <div>
                                <p className="text-gray-500 mb-1">Send Time</p>
                                <p className="font-medium text-gray-900">{workflow.send_time_of_day}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Workflow Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            style={{ marginLeft: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., 24 Hour Appointment Reminder"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Brief description of this workflow..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trigger Event
                    </label>
                    <select
                      value={formData.trigger_event_type}
                      onChange={(e) => setFormData({ ...formData, trigger_event_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {TRIGGER_EVENTS.map((event) => (
                        <option key={event.value} value={event.value}>
                          {event.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Communication Type
                    </label>
                    <div className="flex gap-4">
                      {(['EMAIL', 'SMS'] as const).map((type) => (
                        <label key={type} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="communication_type"
                            value={type}
                            checked={formData.communication_type === type}
                            onChange={(e) => setFormData({ ...formData, communication_type: e.target.value as 'EMAIL' | 'SMS' })}
                            className="text-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template
                    </label>
                    <select
                      value={formData.template_id}
                      onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select a template...</option>
                      {templates
                        .filter(t => t.type === formData.communication_type)
                        .map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                    </select>
                    {errors.template_id && <p className="text-red-500 text-sm mt-1">{errors.template_id}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timing
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={formData.offset_direction}
                          onChange={(e) => setFormData({ ...formData, offset_direction: e.target.value as any })}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="IMMEDIATE">Immediately</option>
                          <option value="BEFORE">Before</option>
                          <option value="AFTER">After</option>
                        </select>
                        
                        {formData.offset_direction !== 'IMMEDIATE' && (
                          <>
                            <input
                              type="number"
                              value={formData.offset_value}
                              onChange={(e) => setFormData({ ...formData, offset_value: parseInt(e.target.value) || 0 })}
                              min="0"
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            
                            <select
                              value={formData.offset_unit}
                              onChange={(e) => setFormData({ ...formData, offset_unit: e.target.value as any })}
                              className="px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="MINUTES">Minutes</option>
                              <option value="HOURS">Hours</option>
                              <option value="DAYS">Days</option>
                            </select>
                          </>
                        )}
                      </div>
                      
                      {formData.offset_direction !== 'IMMEDIATE' && formData.offset_unit !== 'MINUTES' && (
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Send at specific time (optional)
                          </label>
                          <input
                            type="time"
                            value={formData.send_time_of_day || ''}
                            onChange={(e) => setFormData({ ...formData, send_time_of_day: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                    {errors.offset_value && <p className="text-red-500 text-sm mt-1">{errors.offset_value}</p>}
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Workflow is active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  className="flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingWorkflow ? 'Update Workflow' : 'Create Workflow'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Workflows;