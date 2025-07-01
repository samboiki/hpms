/**
 * Smart Notification Manager Component
 * 
 * Provides a comprehensive interface for managing smart notification triggers,
 * monitoring notification delivery, and configuring automated workflows.
 */

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface NotificationTrigger {
  id: string;
  trigger_name: string;
  table_name: string;
  event_type: 'INSERT' | 'UPDATE' | 'DELETE';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  enabled: boolean;
  conditions: any;
  actions: any[];
  created_at: string;
  updated_at: string;
}

interface NotificationQueueItem {
  id: string;
  trigger_name: string;
  table_name: string;
  priority: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

interface NotificationDelivery {
  id: string;
  channel: 'sms' | 'email' | 'in_app' | 'push';
  recipient_type: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  created_at: string;
}

const SmartNotificationManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'triggers' | 'queue' | 'deliveries' | 'analytics'>('triggers');
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [queueItems, setQueueItems] = useState<NotificationQueueItem[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrigger, setSelectedTrigger] = useState<NotificationTrigger | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTriggers(),
        loadQueueItems(),
        loadDeliveries()
      ]);
    } catch (error) {
      console.error('Error loading notification data:', error);
      toast.error('Failed to load notification data');
    } finally {
      setLoading(false);
    }
  };

  const loadTriggers = async () => {
    const { data, error } = await supabase
      .from('notification_triggers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading triggers:', error);
      return;
    }

    setTriggers(data || []);
  };

  const loadQueueItems = async () => {
    const { data, error } = await supabase
      .from('notification_queue')
      .select(`
        id,
        table_name,
        priority,
        status,
        created_at,
        processed_at,
        error_message,
        notification_triggers(trigger_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading queue items:', error);
      return;
    }

    const formattedData = data?.map(item => ({
      id: item.id,
      trigger_name: item.notification_triggers?.trigger_name || 'Unknown',
      table_name: item.table_name,
      priority: item.priority,
      status: item.status,
      created_at: item.created_at,
      processed_at: item.processed_at,
      error_message: item.error_message
    })) || [];

    setQueueItems(formattedData);
  };

  const loadDeliveries = async () => {
    const { data, error } = await supabase
      .from('smart_notification_deliveries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading deliveries:', error);
      return;
    }

    setDeliveries(data || []);
  };

  const installDefaultTriggers = async () => {
    try {
      const response = await fetch('/api/v1/functions/smart-notification-processor?action=install_defaults', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to install default triggers');
      }

      toast.success('Default triggers installed successfully');
      await loadTriggers();
    } catch (error) {
      console.error('Error installing triggers:', error);
      toast.error('Failed to install default triggers');
    }
  };

  const processNotificationQueue = async () => {
    try {
      const response = await fetch('/api/v1/functions/smart-notification-processor?action=process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to process notification queue');
      }

      const result = await response.json();
      toast.success(`Processed ${result.processed} notifications`);
      await loadQueueItems();
      await loadDeliveries();
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process notification queue');
    }
  };

  const toggleTrigger = async (triggerId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('notification_triggers')
      .update({ enabled })
      .eq('id', triggerId);

    if (error) {
      console.error('Error updating trigger:', error);
      toast.error('Failed to update trigger');
      return;
    }

    toast.success(`Trigger ${enabled ? 'enabled' : 'disabled'}`);
    await loadTriggers();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'delivered': return 'text-green-600 bg-green-50';
      case 'pending': case 'processing': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'sent': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Icon icon="solar:loading-bold-duotone" className="w-6 h-6 animate-spin text-blue-600" />
          <span>Loading notification system...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Notification Manager</h1>
          <p className="text-gray-600">Manage automated healthcare workflow notifications</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={installDefaultTriggers}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Icon icon="solar:download-bold-duotone" className="w-5 h-5" />
            <span>Install Defaults</span>
          </button>
          <button
            onClick={processNotificationQueue}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Icon icon="solar:play-bold-duotone" className="w-5 h-5" />
            <span>Process Queue</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'triggers', name: 'Triggers', icon: 'solar:settings-bold-duotone', count: triggers.length },
            { id: 'queue', name: 'Queue', icon: 'solar:clock-circle-bold-duotone', count: queueItems.filter(q => q.status === 'pending').length },
            { id: 'deliveries', name: 'Deliveries', icon: 'solar:letter-bold-duotone', count: deliveries.filter(d => d.status === 'delivered').length },
            { id: 'analytics', name: 'Analytics', icon: 'solar:chart-bold-duotone', count: 0 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Icon icon={tab.icon} className="w-5 h-5" />
              <span>{tab.name}</span>
              {tab.count > 0 && (
                <span className="bg-gray-100 text-gray-900 rounded-full px-2 py-1 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'triggers' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notification Triggers</h2>
              <button
                onClick={() => setShowTriggerModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                <span>Add Trigger</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trigger
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {triggers.map((trigger) => (
                    <tr key={trigger.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{trigger.trigger_name}</div>
                          <div className="text-sm text-gray-500">{trigger.category}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trigger.table_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          {trigger.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(trigger.priority)}`}>
                          {trigger.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleTrigger(trigger.id, !trigger.enabled)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            trigger.enabled 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <Icon 
                            icon={trigger.enabled ? 'solar:check-circle-bold-duotone' : 'solar:close-circle-bold-duotone'} 
                            className="w-4 h-4 mr-1" 
                          />
                          {trigger.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedTrigger(trigger);
                            setShowTriggerModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Icon icon="solar:edit-bold-duotone" className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notification Queue</h2>
              <button
                onClick={loadQueueItems}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
              >
                <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trigger
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {queueItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.trigger_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.table_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.processed_at ? new Date(item.processed_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'deliveries' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notification Deliveries</h2>
              <button
                onClick={loadDeliveries}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
              >
                <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Icon 
                            icon={
                              delivery.channel === 'sms' ? 'solar:chat-round-bold-duotone' :
                              delivery.channel === 'email' ? 'solar:letter-bold-duotone' :
                              delivery.channel === 'in_app' ? 'solar:notification-bold-duotone' :
                              'solar:bell-bold-duotone'
                            } 
                            className="w-5 h-5 text-gray-500" 
                          />
                          <span className="text-sm font-medium text-gray-900">{delivery.channel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{delivery.recipient_type}</div>
                          <div className="text-sm text-gray-500">{delivery.recipient_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(delivery.status)}`}>
                          {delivery.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {delivery.sent_at ? new Date(delivery.sent_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {delivery.error_message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Icon icon="solar:settings-bold-duotone" className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-blue-600">{triggers.length}</div>
                    <div className="text-sm text-blue-600">Active Triggers</div>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Icon icon="solar:clock-circle-bold-duotone" className="w-8 h-8 text-yellow-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-yellow-600">
                      {queueItems.filter(q => q.status === 'pending').length}
                    </div>
                    <div className="text-sm text-yellow-600">Pending</div>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-green-600">
                      {deliveries.filter(d => d.status === 'delivered').length}
                    </div>
                    <div className="text-sm text-green-600">Delivered</div>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Icon icon="solar:close-circle-bold-duotone" className="w-8 h-8 text-red-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold text-red-600">
                      {deliveries.filter(d => d.status === 'failed').length}
                    </div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartNotificationManager;