import React, { useState, useEffect } from 'react';
import { 
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState('7days');
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalMessages: 0,
    emailCount: 0,
    smsCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    pendingCount: 0,
    deliveryRate: 0,
    openRate: 0,
    messagesByDay: [] as any[],
    messagesByType: [] as any[],
    messagesByStatus: [] as any[],
    topTemplates: [] as any[],
    workflowPerformance: [] as any[]
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      let startDate = new Date();
      
      if (dateRange === 'today') {
        startDate = startOfDay(new Date());
      } else if (dateRange === '7days') {
        startDate = subDays(endDate, 7);
      } else if (dateRange === '30days') {
        startDate = subDays(endDate, 30);
      } else if (dateRange === '90days') {
        startDate = subDays(endDate, 90);
      }

      // Fetch communications data
      const { data: logs, error } = await supabase
        .from('communications_log')
        .select(`
          *,
          workflow:workflows(name),
          template:communication_templates(name)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Process analytics
      const totalMessages = logs?.length || 0;
      const emailCount = logs?.filter(l => l.type === 'EMAIL').length || 0;
      const smsCount = logs?.filter(l => l.type === 'SMS').length || 0;
      const deliveredCount = logs?.filter(l => ['SENT', 'DELIVERED'].includes(l.status)).length || 0;
      const failedCount = logs?.filter(l => ['FAILED', 'UNDELIVERED'].includes(l.status)).length || 0;
      const pendingCount = logs?.filter(l => ['PENDING', 'QUEUED'].includes(l.status)).length || 0;
      const deliveryRate = totalMessages > 0 ? (deliveredCount / totalMessages) * 100 : 0;
      const openedCount = logs?.filter(l => l.opened_at).length || 0;
      const openRate = emailCount > 0 ? (openedCount / emailCount) * 100 : 0;

      // Messages by day
      const messagesByDayMap = new Map();
      for (let i = 0; i <= (dateRange === 'today' ? 23 : parseInt(dateRange)); i++) {
        const date = dateRange === 'today' 
          ? format(new Date().setHours(i), 'ha')
          : format(subDays(endDate, i), 'MMM dd');
        messagesByDayMap.set(date, { date, emails: 0, sms: 0 });
      }

      logs?.forEach(log => {
        const date = dateRange === 'today'
          ? format(new Date(log.created_at), 'ha')
          : format(new Date(log.created_at), 'MMM dd');
        
        if (messagesByDayMap.has(date)) {
          const dayData = messagesByDayMap.get(date);
          if (log.type === 'EMAIL') {
            dayData.emails++;
          } else {
            dayData.sms++;
          }
        }
      });

      const messagesByDay = Array.from(messagesByDayMap.values()).reverse();

      // Messages by type
      const messagesByType = [
        { name: 'Email', value: emailCount, color: '#3B82F6' },
        { name: 'SMS', value: smsCount, color: '#8B5CF6' }
      ];

      // Messages by status
      const messagesByStatus = [
        { name: 'Delivered', value: deliveredCount, color: '#10B981' },
        { name: 'Failed', value: failedCount, color: '#EF4444' },
        { name: 'Pending', value: pendingCount, color: '#F59E0B' }
      ];

      // Top templates
      const templateUsage = new Map();
      logs?.forEach(log => {
        if (log.template_id && log.template) {
          const templateName = log.template.name;
          templateUsage.set(templateName, (templateUsage.get(templateName) || 0) + 1);
        }
      });

      const topTemplates = Array.from(templateUsage.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Workflow performance
      const workflowUsage = new Map();
      logs?.forEach(log => {
        if (log.workflow_id && log.workflow) {
          const workflowName = log.workflow.name;
          if (!workflowUsage.has(workflowName)) {
            workflowUsage.set(workflowName, { 
              name: workflowName, 
              sent: 0, 
              delivered: 0, 
              failed: 0 
            });
          }
          const workflow = workflowUsage.get(workflowName);
          workflow.sent++;
          if (['SENT', 'DELIVERED'].includes(log.status)) {
            workflow.delivered++;
          } else if (['FAILED', 'UNDELIVERED'].includes(log.status)) {
            workflow.failed++;
          }
        }
      });

      const workflowPerformance = Array.from(workflowUsage.values())
        .map(w => ({
          ...w,
          successRate: w.sent > 0 ? (w.delivered / w.sent) * 100 : 0
        }))
        .sort((a, b) => b.sent - a.sent)
        .slice(0, 5);

      setAnalytics({
        totalMessages,
        emailCount,
        smsCount,
        deliveredCount,
        failedCount,
        pendingCount,
        deliveryRate,
        openRate,
        messagesByDay,
        messagesByType,
        messagesByStatus,
        topTemplates,
        workflowPerformance
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportAnalytics = () => {
    const report = `Communication Analytics Report
Date Range: ${dateRange}
Generated: ${format(new Date(), 'PPp')}

Summary:
- Total Messages: ${analytics.totalMessages}
- Emails: ${analytics.emailCount}
- SMS: ${analytics.smsCount}
- Delivery Rate: ${analytics.deliveryRate.toFixed(1)}%
- Email Open Rate: ${analytics.openRate.toFixed(1)}%

Status Breakdown:
- Delivered: ${analytics.deliveredCount}
- Failed: ${analytics.failedCount}
- Pending: ${analytics.pendingCount}

Top Templates:
${analytics.topTemplates.map(t => `- ${t.name}: ${t.count} uses`).join('\n')}

Workflow Performance:
${analytics.workflowPerformance.map(w => `- ${w.name}: ${w.sent} sent, ${w.successRate.toFixed(1)}% success rate`).join('\n')}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communication-analytics-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
  };


  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Communication Analytics</h1>
          <p className="text-gray-600 text-lg">Track and analyze your messaging performance</p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
          </select>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportAnalytics}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-5 h-5 text-primary-500" />
                <span className="text-2xl font-bold text-gray-900">{analytics.totalMessages}</span>
              </div>
              <p className="text-sm text-gray-600">Total Messages</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-gray-900">{analytics.deliveryRate.toFixed(1)}%</span>
              </div>
              <p className="text-sm text-gray-600">Delivery Rate</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <Mail className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-gray-900">{analytics.openRate.toFixed(1)}%</span>
              </div>
              <p className="text-sm text-gray-600">Email Open Rate</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-2xl font-bold text-gray-900">{analytics.failedCount}</span>
              </div>
              <p className="text-sm text-gray-600">Failed Messages</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold text-gray-900">{analytics.pendingCount}</span>
              </div>
              <p className="text-sm text-gray-600">Pending Messages</p>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Messages Over Time */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Messages Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.messagesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="emails" fill="#3B82F6" name="Email" />
                  <Bar dataKey="sms" fill="#8B5CF6" name="SMS" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Message Type Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.messagesByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.messagesByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Status Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.messagesByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.messagesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Templates */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Templates</h3>
              {analytics.topTemplates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No template usage data available</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topTemplates.map((template, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{template.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ 
                              width: `${(template.count / analytics.topTemplates[0].count) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{template.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Workflow Performance */}
          {analytics.workflowPerformance.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workflow
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Messages Sent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Delivered
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Failed
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.workflowPerformance.map((workflow, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {workflow.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {workflow.sent}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {workflow.delivered}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {workflow.failed}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  workflow.successRate >= 90 ? 'bg-green-500' :
                                  workflow.successRate >= 70 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${workflow.successRate}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {workflow.successRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;